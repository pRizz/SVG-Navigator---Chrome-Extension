/*
 * Copyright (c) 2013, Asad Akram, Ryan Oblenida, Peter Ryszkiewicz
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


/**
 * svgNavigator.ts
 * Contains all the logic for panning, zooming, and other controls.
 */

import { BUILD_TIMESTAMP } from './buildInfo';
import {
    DEFAULT_SETTINGS,
    SCROLL_SENSITIVITY_RANGE,
    isSettingKey,
    loadSettings,
    parseSettings,
    type Settings,
} from '../shared/settings';
import { addToolbar } from './toolbar';
import {
    fitToAspectRatio,
    formatViewBox,
    parseViewBox,
    wheelZoomFactor,
    zoomAroundCenter,
    zoomAroundPoint,
    type ViewBox,
} from './viewBox';

// TODO: Reduce the need for globals. They are assigned in main() before any
// listener that reads them is attached.

// define svg namespace
const svgNS = 'http://www.w3.org/2000/svg';
let svgDocument: SVGSVGElement;

// wrap the svg document in an html document
let svgDocElement: SVGSVGElement;
let htmlDoc: Document;
let origSVGWidth: number;
let origSVGHeight: number;
let originalViewBoxText: string | null;
let viewBox: ViewBox;

// global variables for zooming
let zoomAction = false;
let zoomX1 = 0;
let zoomY1 = 0;
let zoomX2 = 0;
let zoomY2 = 0;
let zoomWidth = 0;
let zoomHeight = 0;
let zoomRectangle: SVGRectElement;

// global variables for panning
let panStart_Spacebar = true; // TODO try to not need these separate variables
let panAction_Spacebar = false; // TODO try to not need these separate variables
let panStart_Mouse = true; // TODO try to not need these separate variables
let panAction_Mouse = false; // TODO try to not need these separate variables
let panViewBoxX = 0;
let panViewBoxY = 0;
let panOldX = 0;
let panOldY = 0;
let panNewX = 0;
let panNewY = 0;

// current settings; replaced from storage in main() and kept live by onSettingsChanged
let settings: Settings = { ...DEFAULT_SETTINGS };

// for debugging
let debugTextElement: HTMLDivElement | null = null;
const debugChildren: HTMLDivElement[] = [];
let debugMouseEvent: Pick<MouseEvent, 'clientX' | 'clientY'> = {
    clientX: 0,
    clientY: 0
};

main().catch((error: unknown) => {
    console.error('SVG Navigator: failed to start', error);
});

async function main(): Promise<void> {
    const maybeSvgRoot = getStandaloneSvgRoot();
    if(!maybeSvgRoot) { return; }

    // wrap the svg document in an html document
    svgDocElement = maybeSvgRoot;
    htmlDoc = document.implementation.createHTMLDocument();

    document.replaceChild(htmlDoc.documentElement, svgDocElement);

    // the htmlDoc is the new document object
    document.body.appendChild(svgDocElement);
    document.body.style.margin = '0';
    document.body.style.overflowY = 'scroll';

    // document variables
    const maybeSvgDocument = document.getElementsByTagName('svg')[0];

    if(!maybeSvgDocument) {
        console.error('SVG Navigator: No SVG element found');
        return;
    }
    svgDocument = maybeSvgDocument;

    // @since 2.6
    // Remove of the SVG element `style` `width` and `height` in case
    // these limit the visible SVG area.
    // See `examples/plantuml.html` and `examples/githubsvg.html` for the use case.
    const style = svgDocument.getAttribute('style');
    if (style) {
        // Define regex patterns for width and height separately
        const widthRegex = /(\s*width\s*:\s*[^;]+;\s*)/g;
        const heightRegex = /(\s*height\s*:\s*[^;]+;\s*)/g;

        // Remove 'width' properties from the style attribute
        let newStyle = style.replace(widthRegex, '');

        // Remove 'height' properties from the style attribute
        newStyle = newStyle.replace(heightRegex, '');

        // Update the 'style' attribute of the SVG element with the modified value
        svgDocument.setAttribute('style', newStyle);
    }
    // end @since

    zoomRectangle = insertZoomRect();

    // keep aspect ratio; just remove attribute if it exists
    svgDocument.removeAttribute('preserveAspectRatio');

    // save original svg width and height
    // TODO problematic when width or height contain percent character
    origSVGWidth = parseFloat(svgDocument.getAttribute('width') || String(getWidth()));
    origSVGHeight = parseFloat(svgDocument.getAttribute('height') || String(getHeight()));
    // make width and height 100% to fill client web browser
    svgDocument.setAttribute('width', '100%');
    svgDocument.setAttribute('height', '100%');

    originalViewBoxText = svgDocument.getAttribute('viewBox');
    // check if the svg document had a viewbox
    if(originalViewBoxText === null) {
        console.warn('SVG Navigator: warning: SVG had no viewbox attribute. Making new viewbox attribute.');
        // preferably, we want to set the viewbox as the bounding box values of the SVG from getBBox();
        // unfortunatley, chrome's getBBox() is bugged for some SVG documents, ex: http://upload.wikimedia.org/wikipedia/commons/d/dc/USA_orthographic.svg
        // so we make the viewbox at 0,0 with width and height of client browser
        svgDocument.setAttribute('viewBox', formatViewBox({ x: 0, y: 0, width: origSVGWidth, height: origSVGHeight }));
    }

    fillViewBoxToScreen();
    originalViewBoxText = svgDocument.getAttribute('viewBox');
    // this variable should always be up to date and set the real viewbox when it changes
    viewBox = parseOrGetViewBox();

    settings = await loadSettingsOrDefaults();
    addEventListeners();
    maybeAddToolbar();
    applyBackgroundColor();
    maybePrintDebugInfo();
    // Registered only once an SVG is wrapped, so settings changes never touch other pages.
    chrome.storage.onChanged.addListener(onSettingsChanged);
    disableSelection();

    // Signals that all listeners are attached; E2E tests wait on this to avoid racing setup.
    document.documentElement.dataset.svgNavigator = 'ready';
    console.log(`SVG Navigator v${getVersion()} loaded`);
}

async function loadSettingsOrDefaults(): Promise<Settings> {
    try {
        return await loadSettings();
    } catch(e) {
        console.warn('SVG Navigator: could not read settings; using defaults', e);
        return { ...DEFAULT_SETTINGS };
    }
}

function maybeAddToolbar(): void {
    if(!settings.toolbarEnabled) {
        return;
    }
    addToolbar(htmlDoc, document.body, {
        zoomIn: () => zoomBy(0.8),
        zoomOut: () => zoomOut(true),
        reset: () => zoomOriginal(true),
    }, { autoHide: settings.toolbarAutoHide });
}

// insert a rectangle object into the svg, acting as the zoom rectangle
function insertZoomRect(): SVGRectElement {
    const zoomRectangle = document.createElementNS(svgNS, 'rect');
    zoomRectangle.setAttributeNS(null, 'x', '0');
    zoomRectangle.setAttributeNS(null, 'y', '0');
    zoomRectangle.setAttributeNS(null, 'rx', '0.01');
    zoomRectangle.setAttributeNS(null, 'width', '0');
    zoomRectangle.setAttributeNS(null, 'height', '0');
    zoomRectangle.setAttributeNS(null, 'opacity', '1');
    zoomRectangle.setAttributeNS(null, 'stroke', 'blue');
    zoomRectangle.setAttributeNS(null, 'stroke-width', '1.0');
    zoomRectangle.setAttributeNS(null, 'fill', 'blue');
    zoomRectangle.setAttributeNS(null, 'fill-opacity', '0.1');
    svgDocument.appendChild(zoomRectangle);
    return zoomRectangle;
}

function onSettingsChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string): void {
    if(areaName !== 'sync') { return; }
    for (const [key, { newValue }] of Object.entries(changes)) {
        if(isSettingKey(key)) {
            settings = parseSettings({ ...settings, [key]: newValue });
        }
        if(key === 'showDebugInfo') {
            maybePrintDebugInfo();
            if(settings.showDebugInfo) {
                document.addEventListener('mousemove', trackMouseForDebugInfo, false);
            }
        } else if(key === 'svgBackgroundColor') {
            applyBackgroundColor();
        }
    }
}

// A named listener, so adding it again after re-enabling debug info is a no-op.
function trackMouseForDebugInfo(e: MouseEvent): void {
    debugMouseEvent = e;
    maybePrintDebugInfo();
}

function applyBackgroundColor(): void {
    document.body.style.backgroundColor = settings.svgBackgroundColor;
}

function addEventListeners(): void {
    // event listeners
    document.addEventListener('keydown', panBegin, false); // spacebar panning
    document.addEventListener('mousemove', panMove, false); // spacebar panning
    document.addEventListener('keyup', panEnd, false); // spacebar panning
    document.addEventListener('keyup', zoomOut, false); // alt key zoom out
    document.addEventListener('keyup', zoomOriginal, false); // escape key zoom out
    document.addEventListener('keyup', zoomCtrlKeys, false); // ctrl key zoom in/out
    if(settings.clickAndDragBehavior === 'zoomBox') {
        svgDocument.addEventListener('mousedown', zoomMouseDown, false); // zoom box
        svgDocument.addEventListener('mousemove', zoomMouseMove, false); // zoom box
        svgDocument.addEventListener('mouseup', zoomMouseUp, false); // zoom box
    } else {
        svgDocument.addEventListener('mousedown', panBegin2, false); // mouse panning
        document.addEventListener('mousemove', panMove2, false); // mouse panning
        document.addEventListener('mouseup', panEnd2, false); // mouse panning
    }

    svgDocument.addEventListener('wheel', doScroll, { passive: false }); // Standard event for all modern browsers

    if(settings.showDebugInfo) {
        document.addEventListener('mousemove', trackMouseForDebugInfo, false);
    }
}

/** Converts a point in client (window) coordinates into `element`'s user space. */
function clientToSvgPoint(clientX: number, clientY: number, element: SVGGraphicsElement): DOMPoint {
    const p = svgDocElement.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const m = element.getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : p;
}

/* Zoom Functions */
// click and drag to zoom in
// press escape to zoom out
function zoomMouseDown(evt: MouseEvent): void {
    // only a plain click (no ctrl or shift) outside a pan starts a zoom box
    if(panAction_Spacebar || panAction_Mouse || evt.ctrlKey || evt.shiftKey) { return; }

    zoomAction = true;
    const p = clientToSvgPoint(evt.clientX, evt.clientY, zoomRectangle);
    zoomRectangle.setAttribute('x', String(p.x));
    zoomRectangle.setAttribute('y', String(p.y));
    zoomX1 = p.x;
    zoomY1 = p.y;

    // one screen pixel in viewBox units, as the browser displays the viewBox
    const relativeStrokeWidth = fitToAspectRatio(viewBox, getWidth()/getHeight()).width/getWidth();
    zoomRectangle.setAttributeNS(null, 'stroke-width', String(relativeStrokeWidth));
    zoomRectangle.setAttributeNS(null, 'rx', String(relativeStrokeWidth));
}

// blue zoombox drawn as mouse is moved across screen
function zoomMouseMove(evt: MouseEvent): void {
    if(!zoomAction) { return; }

    const p = clientToSvgPoint(evt.clientX, evt.clientY, zoomRectangle);
    zoomX2 = p.x;
    zoomY2 = p.y;
    zoomWidth = Math.abs(zoomX2 - zoomX1);
    zoomHeight = Math.abs(zoomY2 - zoomY1);

    // set top left corner point of zoom rectangle
    zoomRectangle.setAttribute('x', String(Math.min(zoomX1, zoomX2)));
    zoomRectangle.setAttribute('y', String(Math.min(zoomY1, zoomY2)));
    zoomRectangle.setAttribute('width', String(zoomWidth));
    zoomRectangle.setAttribute('height', String(zoomHeight));
}

function getNumericAttribute(element: Element, name: string): number {
    return parseFloat(element.getAttribute(name) ?? '');
}

// function that completes zoombox, then zooms view to zoombox
function zoomMouseUp(): void {
    // the viewbox width and height is changed when the button is up
    if(zoomAction) {
        const zoomRect = {
            x: getNumericAttribute(zoomRectangle, 'x'),
            y: getNumericAttribute(zoomRectangle, 'y'),
            width: getNumericAttribute(zoomRectangle, 'width'),
            height: getNumericAttribute(zoomRectangle, 'height'),
        };
        if((zoomRect.width*zoomRect.height) > 1e-6) { // prevent zooming on tiny area; svg visual starts acting weird
            // make aspect ratio of new viewbox match the screen aspect ratio; useful later, when adding debug info to corner of screen
            viewBox = fitToAspectRatio(zoomRect, getWidth()/getHeight());
            setViewBox();
        }
    }

    // reset zoom rectangle members
    zoomX1 = 0;
    zoomY1 = 0;
    zoomRectangle.setAttribute('width', '0');
    zoomRectangle.setAttribute('height', '0');

    zoomAction = false;
}

function isZoomingOrPanning(): boolean {
    return zoomAction || panAction_Spacebar || panAction_Mouse;
}

// KeyboardEvent.keyCode is deprecated but is what these key bindings were written against.
function keyCodeOf(evt: KeyboardEvent): number {
    return evt.charCode || evt.keyCode;
}

// zoom out when user presses alt key, or unconditionally when passed `true` (toolbar)
function zoomOut(evt: KeyboardEvent | true): void {
    if(evt === true) {
        zoomBy(1.25);
        return;
    }
    // alt key
    if(!isZoomingOrPanning() && evt.type === 'keyup' && keyCodeOf(evt) === 18) {
        zoomBy(1.25);
    }
}

// below 1 zooms in, above 1 zooms out
function zoomBy(zoomAmount: number): void {
    viewBox = zoomAroundCenter(viewBox, zoomAmount);
    setViewBox();
}

// zoom back to original view when escape button is clicked or Reset button pressed
function zoomOriginal(evt: KeyboardEvent | true): void {
    if(isZoomingOrPanning()) { return; }
    if(evt === true || (evt.type === 'keyup' && keyCodeOf(evt) === 27)) {
        resetViewBox();
    }
}

function resetViewBox(): void {
    viewBox = parseOrGetViewBox(originalViewBoxText);
    setViewBox();
}

// zoom according to ctrl keys
function zoomCtrlKeys(evt: KeyboardEvent): void {
    if(!isZoomingOrPanning() && evt.type === 'keyup' && evt.ctrlKey) {
        const charCode = keyCodeOf(evt);
        if (charCode === 48) { // ctrl-0, reset zoom
            resetViewBox();
        } else if (charCode === 187) { // ctrl-+, zoom in
            zoomBy(0.8);
        } else if (charCode === 189) { // ctrl--, zoom out
            zoomBy(1.25);
        }
    }
}

function panBegin(evt: KeyboardEvent): void {
    if(!panAction_Mouse && !zoomAction && evt.type === 'keydown') {
        // spacebar
        if (keyCodeOf(evt) === 32 && panStart_Spacebar) {
            panStart_Spacebar = true;
            panAction_Spacebar = true;
            svgDocument.style.cursor='move';
        }
    }
}

// pan with mouse down
function panBegin2(): void {
    if(!panAction_Spacebar && !zoomAction) {
        panStart_Mouse = true;
        panAction_Mouse = true;
        svgDocument.style.cursor='move';
    }
}


function panMove(evt: MouseEvent): void {
    if(panStart_Spacebar && panAction_Spacebar) {
        panAction_Spacebar = true;
        panStart_Spacebar = false;
        startPan(evt);
    }
    if(panAction_Spacebar && !panStart_Spacebar) {
        continuePan(evt);
    }
}

// pan with mouse down
function panMove2(evt: MouseEvent): void {
    if(panStart_Mouse && panAction_Mouse) {
        panAction_Mouse = true;
        panStart_Mouse = false;
        startPan(evt);
    }
    if(panAction_Mouse && !panStart_Mouse) {
        continuePan(evt);
    }
}

function startPan(evt: MouseEvent): void {
    const p = clientToSvgPoint(evt.clientX, evt.clientY, svgDocument);

    panOldX = p.x;
    panOldY = p.y;

    panViewBoxX = viewBox.x;
    panViewBoxY = viewBox.y;
}

function continuePan(evt: MouseEvent): void {
    const p = clientToSvgPoint(evt.clientX, evt.clientY, svgDocument);

    panNewX = p.x;
    panNewY = p.y;

    panViewBoxX = viewBox.x;
    panViewBoxY = viewBox.y;

    viewBox.x = panViewBoxX - (panNewX - panOldX);
    viewBox.y = panViewBoxY - (panNewY - panOldY);
    setViewBox();
}


function panEnd(evt: KeyboardEvent): void {
    // spacebar
    if(evt.type === 'keyup' && keyCodeOf(evt) === 32) {
        svgDocument.style.cursor = 'default';
        panStart_Spacebar = true;
        panAction_Spacebar = false;
    }
}

// pan with mouse down
function panEnd2(): void {
    svgDocument.style.cursor = 'default';
    panStart_Mouse = true;
    panAction_Mouse = false;
}

// implementation for scroll zooming
// the area pointed to by the cursor will always stay under the cursor while scrolling/zooming in or out, just like google maps does
// might be different scroll direction on Macs with "natural scroll" vs Windows
function doScroll(evt: WheelEvent): void {
    if(isZoomingOrPanning()) { return; }
    evt.preventDefault(); // prevent default scroll action

    const zoomAmount = wheelZoomFactor(evt.deltaY, {
        sensitivity: settings.scrollSensitivity,
        maxSensitivity: SCROLL_SENSITIVITY_RANGE.max,
        invert: settings.invertScroll,
    });
    const p = clientToSvgPoint(evt.clientX, evt.clientY, svgDocument);
    viewBox = zoomAroundPoint(viewBox, p, zoomAmount);
    setViewBox();
}

// function to get the height of the window containing the svg in pixels; this is not the same as the svg viewbox or screen resolution
function getHeight(): number {
    return self.innerHeight;
}

// function to get the width of the window containing the svg in pixels; this is not the same as the svg viewbox or screen resolution
function getWidth(): number {
    return self.innerWidth;
}


// to prevent selection of text; prevent text Ibar cursor when dragging
function disableSelection(): void {
    document.onselectstart = function () {return false;};
    document.body.style.cursor = 'default';
}

// make aspect ratio of new viewbox match the screen aspect ratio; useful later, when adding debug info to corner of screen
function fillViewBoxToScreen(): void {
    const filled = fitToAspectRatio(parseOrGetViewBox(), getWidth()/getHeight());
    svgDocument.setAttribute('viewBox', formatViewBox(filled));
}

function maybePrintDebugInfo(): void {
    if(!settings.showDebugInfo) {
        if(debugTextElement) {
            document.body.removeChild(debugTextElement);
            debugTextElement = null;
        }
        return;
    }
    const lines = [
        'Debug Info:',
        `ViewBox X: ${viewBox.x}`,
        `ViewBox Y: ${viewBox.y}`,
        `ViewBox Width: ${viewBox.width}`,
        `ViewBox Height: ${viewBox.height}`,
        `CurrentVBW/InitVBW: ${viewBox.width/origSVGWidth}`,
        `CurrentVBH/InitVBH: ${viewBox.height/origSVGHeight}`,
        `Client X: ${debugMouseEvent.clientX}`,
        `Client Y: ${debugMouseEvent.clientY}`,
        `SVG Navigator Version: ${getVersion()}`,
        `Built at: ${BUILD_TIMESTAMP}`,
    ];
    if(!debugTextElement) {
        debugTextElement = htmlDoc.createElement('div');
        debugChildren.length = 0;
        for(let count = 0; count < lines.length; count++) {
            const child = htmlDoc.createElement('div');
            child.style.padding = '1px 3px';
            debugChildren.push(child);
            debugTextElement.appendChild(child);
        }
        debugTextElement.style.position = 'fixed';
        debugTextElement.style.top = '5px';
        debugTextElement.style.left = '5px';
        debugTextElement.style.pointerEvents = 'none';
        debugTextElement.style.padding = '5px';
        debugTextElement.style.background = 'rgba(0, 0, 0, 0.8)';
        debugTextElement.style.border = '1px solid #BBB';
        debugTextElement.style.borderRadius = '5px';
        debugTextElement.style.color = 'white';
        debugTextElement.style.fontFamily = '\'Consolas\', \'Lucida Grande\', sans-serif';

        document.body.appendChild(debugTextElement); // add to DOM
    }
    debugChildren.forEach((child, index) => {
        child.textContent = lines[index] ?? '';
    });
}

// parses `maybeViewBoxText`, falling back to the svg's current viewBox attribute
function parseOrGetViewBox(maybeViewBoxText?: string | null): ViewBox {
    return parseViewBox(maybeViewBoxText || svgDocument.getAttribute('viewBox') || '');
}

function setViewBox(): void {
    svgDocument.setAttribute('viewBox', formatViewBox(viewBox));
    maybePrintDebugInfo();
}

// @since 2.6
// The navigator takes over standalone SVG documents, whatever their URL (extension or
// none), and never HTML pages with inline SVG.
function getStandaloneSvgRoot(): SVGSVGElement | null {
    const root = document.documentElement;
    return root instanceof SVGSVGElement ? root : null;
}

function getVersion(): string {
    return chrome.runtime.getManifest().version;
}
