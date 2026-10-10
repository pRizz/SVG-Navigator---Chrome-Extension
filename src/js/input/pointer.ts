/**
 * Mouse and wheel input on the drawing: drag to pan or to draw a zoom box, Space + move
 * to pan, the wheel to zoom at the pointer, and double-click to zoom 2× there. Owns the interaction state (at most one
 * pan or zoom box at a time) and the zoom box's rectangle; `svgNavigator.ts` supplies
 * the view through `PointerDeps`.
 */

import { SCROLL_SENSITIVITY_RANGE, type ClickAndDragBehavior } from '../../shared/settings';
import type { InteractionKind, WheelSample } from '../hud/debugInfo';
import { doubleClickZoomFactor, isDrag, shouldZoomOnDoubleClick } from './doubleClick';
import {
    fitToAspectRatio,
    panViewBox,
    rectFromCorners,
    wheelZoomFactor,
    zoomAroundPoint,
    type Point,
    type ViewBox,
} from '../viewBox';

const SVG_NS = 'http://www.w3.org/2000/svg';
// Below this area (in user units squared) a zoom box is a click, not a drag.
const MIN_ZOOM_BOX_AREA = 1e-6;

type PanSource = 'spacebar' | 'mouse';

/** What the user is doing with the pointer: at most one zoom box or pan at a time. */
type Interaction =
    | { kind: 'idle' }
    | { kind: 'zoomBox', start: Point }
    // The pan key or button is down; the pan anchors at the next mouse move.
    | { kind: 'panReady', source: PanSource }
    | { kind: 'panning', source: PanSource, anchor: Point };

export interface PointerDeps {
    /** The root `<svg>`, which receives the mouse and wheel events. */
    svg: SVGSVGElement;
    clickAndDragBehavior: ClickAndDragBehavior;
    view: () => ViewBox;
    showViewBox: (next: ViewBox) => void;
    /** The current wheel settings; read on every wheel event, so changes apply live. */
    wheelSettings: () => { sensitivity: number, invert: boolean };
    onInteractionChange: () => void;
    onWheel: (sample: WheelSample) => void;
}

export interface PointerInput {
    interactionKind: () => InteractionKind;
    /** True during a pan or a zoom box, which keyboard zooms must not interrupt. */
    isBusy: () => boolean;
    beginSpacePan: () => void;
    endSpacePan: () => void;
    /** Whether `element` is the zoom box's own rectangle, which sits over the drawing. */
    isZoomRectangle: (element: Element) => boolean;
}

/** Converts a point in client (window) coordinates into `element`'s user space. */
export function clientToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number, element: SVGGraphicsElement): DOMPoint {
    const p = svg.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const m = element.getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : p;
}

/** Attaches the drawing's mouse and wheel listeners. */
export function attachPointerInput(deps: PointerDeps): PointerInput {
    const { svg } = deps;
    const zoomRectangle = insertZoomRectangle(svg);
    let interaction: Interaction = { kind: 'idle' };
    // for telling a double-click from two quick drags
    let maybePress: Point | null = null;
    let maybeLastDragEndMs: number | null = null;

    const toSvgPoint = (evt: MouseEvent, element: SVGGraphicsElement): DOMPoint =>
        clientToSvgPoint(svg, evt.clientX, evt.clientY, element);

    function setInteraction(next: Interaction): void {
        interaction = next;
        deps.onInteractionChange();
    }

    function isPanning(): boolean {
        return interaction.kind === 'panReady' || interaction.kind === 'panning';
    }

    // a pan starts only when nothing else is going on; held-key repeats are ignored
    function panBegin(source: PanSource): void {
        if(interaction.kind !== 'idle') { return; }
        setInteraction({ kind: 'panReady', source });
        svg.style.cursor = 'move';
    }

    // the first move anchors the point under the cursor; later moves keep it there
    function panMove(evt: MouseEvent): void {
        if(interaction.kind === 'panReady') {
            setInteraction({ kind: 'panning', source: interaction.source, anchor: toSvgPoint(evt, svg) });
            return;
        }
        if(interaction.kind !== 'panning') { return; }
        deps.showViewBox(panViewBox(deps.view(), interaction.anchor, toSvgPoint(evt, svg)));
    }

    function panEnd(source: PanSource): void {
        if(interaction.kind !== 'panReady' && interaction.kind !== 'panning') { return; }
        if(interaction.source !== source) { return; }
        setInteraction({ kind: 'idle' });
        svg.style.cursor = 'default';
    }

    function zoomBoxDown(evt: MouseEvent): void {
        // only a plain click (no ctrl or shift) outside a pan starts a zoom box
        if(isPanning() || evt.ctrlKey || evt.shiftKey) { return; }

        const start = toSvgPoint(evt, zoomRectangle);
        setInteraction({ kind: 'zoomBox', start });
        zoomRectangle.setAttribute('x', String(start.x));
        zoomRectangle.setAttribute('y', String(start.y));

        // one screen pixel in viewBox units, as the browser displays the viewBox
        const relativeStrokeWidth = fitToAspectRatio(deps.view(), innerWidth/innerHeight).width/innerWidth;
        zoomRectangle.setAttributeNS(null, 'stroke-width', String(relativeStrokeWidth));
        zoomRectangle.setAttributeNS(null, 'rx', String(relativeStrokeWidth));
    }

    function zoomBoxMove(evt: MouseEvent): void {
        if(interaction.kind !== 'zoomBox') { return; }

        const rect = rectFromCorners(interaction.start, toSvgPoint(evt, zoomRectangle));
        zoomRectangle.setAttribute('x', String(rect.x));
        zoomRectangle.setAttribute('y', String(rect.y));
        zoomRectangle.setAttribute('width', String(rect.width));
        zoomRectangle.setAttribute('height', String(rect.height));
    }

    // completes the zoom box and zooms the view to it
    function zoomBoxUp(): void {
        if(interaction.kind === 'zoomBox') {
            setInteraction({ kind: 'idle' });
            const zoomRect = {
                x: numericAttribute(zoomRectangle, 'x'),
                y: numericAttribute(zoomRectangle, 'y'),
                width: numericAttribute(zoomRectangle, 'width'),
                height: numericAttribute(zoomRectangle, 'height'),
            };
            if(zoomRect.width * zoomRect.height > MIN_ZOOM_BOX_AREA) {
                // match the window's aspect ratio, so the whole box shows, centered
                deps.showViewBox(fitToAspectRatio(zoomRect, innerWidth/innerHeight));
            }
        }
        zoomRectangle.setAttribute('width', '0');
        zoomRectangle.setAttribute('height', '0');
    }

    // the point under the cursor stays under the cursor while zooming, like a map
    function wheelZoom(evt: WheelEvent): void {
        deps.onWheel({ deltaY: evt.deltaY, deltaMode: evt.deltaMode });
        if(interaction.kind !== 'idle') { return; }
        evt.preventDefault(); // the page itself must not scroll

        const { sensitivity, invert } = deps.wheelSettings();
        const zoomAmount = wheelZoomFactor(evt.deltaY, { sensitivity, maxSensitivity: SCROLL_SENSITIVITY_RANGE.max, invert });
        deps.showViewBox(zoomAroundPoint(deps.view(), toSvgPoint(evt, svg), zoomAmount));
    }

    function rememberPress(evt: MouseEvent): void {
        if(evt.button === 0) { maybePress = { x: evt.clientX, y: evt.clientY }; }
    }

    function noteDragEnd(evt: MouseEvent): void {
        if(maybePress !== null && isDrag(maybePress, { x: evt.clientX, y: evt.clientY })) {
            maybeLastDragEndMs = evt.timeStamp;
        }
        maybePress = null;
    }

    function doubleClickZoom(evt: MouseEvent): void {
        if(evt.button !== 0 || interaction.kind !== 'idle') { return; }
        if(!shouldZoomOnDoubleClick(evt.timeStamp, maybeLastDragEndMs)) { return; }
        evt.preventDefault();
        deps.showViewBox(zoomAroundPoint(deps.view(), toSvgPoint(evt, svg), doubleClickZoomFactor(evt.shiftKey)));
    }

    // registered before the drag handlers, so a press is seen before a pan or zoom box starts
    svg.addEventListener('mousedown', rememberPress, false);
    document.addEventListener('mouseup', noteDragEnd, false);
    svg.addEventListener('dblclick', doubleClickZoom, false);
    document.addEventListener('mousemove', panMove, false); // Space and mouse panning
    if(deps.clickAndDragBehavior === 'zoomBox') {
        svg.addEventListener('mousedown', zoomBoxDown, false);
        svg.addEventListener('mousemove', zoomBoxMove, false);
        svg.addEventListener('mouseup', zoomBoxUp, false);
    } else {
        svg.addEventListener('mousedown', () => panBegin('mouse'), false);
        document.addEventListener('mouseup', () => panEnd('mouse'), false);
    }
    svg.addEventListener('wheel', wheelZoom, { passive: false });

    return {
        interactionKind: () => interaction.kind,
        isBusy: () => interaction.kind !== 'idle',
        beginSpacePan: () => panBegin('spacebar'),
        endSpacePan: () => panEnd('spacebar'),
        isZoomRectangle: (element) => element === zoomRectangle,
    };
}

// the zoom box's rectangle, drawn inside the SVG and hidden at zero size until a drag
function insertZoomRectangle(svg: SVGSVGElement): SVGRectElement {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttributeNS(null, 'x', '0');
    rect.setAttributeNS(null, 'y', '0');
    rect.setAttributeNS(null, 'rx', '0.01');
    rect.setAttributeNS(null, 'width', '0');
    rect.setAttributeNS(null, 'height', '0');
    rect.setAttributeNS(null, 'opacity', '1');
    rect.setAttributeNS(null, 'stroke', 'blue');
    rect.setAttributeNS(null, 'stroke-width', '1.0');
    rect.setAttributeNS(null, 'fill', 'blue');
    rect.setAttributeNS(null, 'fill-opacity', '0.1');
    svg.appendChild(rect);
    return rect;
}

function numericAttribute(element: Element, name: string): number {
    return parseFloat(element.getAttribute(name) ?? '');
}
