/**
 * The minimap (#48): an overview of the whole drawing with the current view outlined,
 * shown while part of the drawing is out of view. Click to jump there; drag the outline
 * to pan. The overview is a copy of the drawing's own markup, made the first time it's
 * needed: inline markup works under any page Content-Security-Policy, renders once, and
 * the copy's scripts never run. The copy sits in a shadow root of its own, so the
 * drawing's stylesheet styles only the copy, never the HUD around it. It's cached on
 * its own compositing layer, so panning only moves the outline, and its animations are
 * paused. A drawing too large to copy gets the outline on a plain box instead.
 */

import { ZOOM_BOX_ATTRIBUTE } from '../input/pointer';
import { formatViewBox, type Point, type ViewBox } from '../viewBox';
import type { MinimapCorner } from './layout';
import { copiesDrawing, drawingPointAt, minimapSize, outlineRect, showsWholeDrawing, viewCenteredOn, type Size } from './minimapGeometry';
import { adoptStyles } from './shadowHost';

// The copy is too small to follow animations, and running them would cost CPU for nothing.
const STILL_COPY_CSS = '*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }';

export interface MinimapActions {
    /** Shows a view at once, as a drag does. */
    showView: (next: ViewBox) => void;
    /** Eases to a view, as a click does. */
    animateView: (next: ViewBox) => void;
}

export interface Minimap {
    element: HTMLDivElement;
    /** Redraws the outline for `view`; `whole` is the whole drawing at 100%. */
    update: (view: ViewBox, whole: ViewBox) => void;
    setCorner: (corner: MinimapCorner) => void;
}

export function createMinimap(htmlDoc: Document, drawing: SVGSVGElement, corner: MinimapCorner, actions: MinimapActions): Minimap {
    const element = htmlDoc.createElement('div');
    element.className = 'minimap';
    // A pointer shortcut; keyboard users have the arrow keys and zoom keys.
    element.setAttribute('aria-hidden', 'true');
    element.hidden = true;
    const outline = htmlDoc.createElement('div');
    outline.className = 'minimap-outline';
    element.append(outline);

    let maybeLatest: { view: ViewBox, whole: ViewBox, size: Size } | null = null;
    let isOverviewBuilt = false;
    // While dragging: where in the outline the pointer grabbed it, so it doesn't jump.
    let maybeGrabOffset: Point | null = null;

    function buildOverview(whole: ViewBox, size: Size): void {
        element.style.width = `${size.width}px`;
        element.style.height = `${size.height}px`;
        isOverviewBuilt = true;
        if (!copiesDrawing(drawing.getElementsByTagName('*').length)) {
            element.classList.add('minimap-plain');
            return;
        }
        const copy = drawing.cloneNode(true);
        if (!(copy instanceof SVGSVGElement)) { return; }
        for (const zoomBox of copy.querySelectorAll(`[${ZOOM_BOX_ATTRIBUTE}]`)) {
            zoomBox.remove();
        }
        // The navigator's own attributes on the drawing (its view, the inverted filter) don't belong here.
        copy.removeAttribute('style');
        // Block, so no inline baseline gap shows under it.
        copy.style.display = 'block';
        copy.setAttribute('viewBox', formatViewBox(whole));
        copy.setAttribute('width', '100%');
        copy.setAttribute('height', '100%');
        copy.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        const frame = htmlDoc.createElement('div');
        frame.className = 'minimap-frame';
        const frameRoot = frame.attachShadow({ mode: 'open' });
        adoptStyles(htmlDoc, frameRoot, STILL_COPY_CSS);
        frameRoot.append(copy);
        element.prepend(frame);
        // SMIL animations are paused separately from CSS ones.
        copy.pauseAnimations();
    }

    function localPoint(evt: PointerEvent): Point {
        const box = element.getBoundingClientRect();
        return { x: evt.clientX - box.left, y: evt.clientY - box.top };
    }

    function viewWithCenterAt(pixel: Point): ViewBox | null {
        if (maybeLatest === null) { return null; }
        const { view, whole, size } = maybeLatest;
        return viewCenteredOn(view, drawingPointAt(pixel, whole, size));
    }

    element.addEventListener('pointerdown', (evt) => {
        if (evt.button !== 0 || maybeLatest === null) { return; }
        evt.preventDefault();
        element.setPointerCapture(evt.pointerId);
        const pointer = localPoint(evt);
        const rect = outlineRect(maybeLatest.view, maybeLatest.whole, maybeLatest.size);
        const isOnOutline = pointer.x >= rect.x && pointer.x <= rect.x + rect.width
            && pointer.y >= rect.y && pointer.y <= rect.y + rect.height;
        if (isOnOutline) {
            maybeGrabOffset = { x: pointer.x - (rect.x + rect.width / 2), y: pointer.y - (rect.y + rect.height / 2) };
            return;
        }
        // A click elsewhere jumps there, and the outline is grabbed by its middle from then on.
        maybeGrabOffset = { x: 0, y: 0 };
        const maybeView = viewWithCenterAt(pointer);
        if (maybeView) { actions.animateView(maybeView); }
    });
    element.addEventListener('pointermove', (evt) => {
        if (maybeGrabOffset === null) { return; }
        const pointer = localPoint(evt);
        const maybeView = viewWithCenterAt({ x: pointer.x - maybeGrabOffset.x, y: pointer.y - maybeGrabOffset.y });
        if (maybeView) { actions.showView(maybeView); }
    });
    const endDrag = (): void => {
        maybeGrabOffset = null;
    };
    element.addEventListener('pointerup', endDrag);
    element.addEventListener('pointercancel', endDrag);
    // The page behind must not scroll; zooming over the minimap isn't supported.
    element.addEventListener('wheel', (evt) => evt.preventDefault(), { passive: false });

    function setCorner(next: MinimapCorner): void {
        element.dataset.corner = next;
    }
    setCorner(corner);

    return {
        element,
        update: (view, whole) => {
            const isNeeded = !showsWholeDrawing(view, whole);
            element.hidden = !isNeeded;
            if (!isNeeded) { return; }
            const size = minimapSize(whole);
            if (!isOverviewBuilt) { buildOverview(whole, size); }
            maybeLatest = { view, whole, size };
            const rect = outlineRect(view, whole, size);
            Object.assign(outline.style, {
                left: `${rect.x}px`,
                top: `${rect.y}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
            });
        },
        setCorner,
    };
}
