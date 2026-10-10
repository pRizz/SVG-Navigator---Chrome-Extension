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

import { BUILD_INFO } from './buildInfo';
import {
    DEFAULT_SETTINGS,
    isSettingKey,
    loadSettings,
    parseSettings,
    type SettingKey,
    type Settings,
} from '../shared/settings';
import { mountHud, type HudHandle } from './hud/hud';
import { keyAction, type KeyAction } from './input/keyActions';
import { attachPointerInput, clientToSvgPoint, type PointerInput } from './input/pointer';
import { formatSvgViewFragment, maybeParseSvgViewFragment, ownsFragment } from './viewFragment';
import { listenForPageSwitch, readPageState } from './offSwitch';
import { HUD_HOST_TAG } from './hud/shadowHost';
import {
    describeBrowser,
    type DebugInfo,
    type DocumentFacts,
    type ElementSummary,
    type UaBrand,
    type WheelSample,
} from './hud/debugInfo';
import {
    displayedZoom,
    fitToAspectRatio,
    formatViewBox,
    isRepresentableViewBox,
    lengthToPixels,
    maybeParseViewBox,
    nudgeViewBox,
    zoomAroundCenter,
    type Point,
    type ViewBox,
} from './viewBox';

// TODO: Reduce the need for globals. They are assigned in main() before any
// listener that reads them is attached.

let svgDocument: SVGSVGElement;

// wrap the svg document in an html document
let svgDocElement: SVGSVGElement;
let htmlDoc: Document;
// the view that Escape, Ctrl+0, and the HUD's zoom readout return to
let originalViewBox: ViewBox;
let viewBox: ViewBox;

// attached in addEventListeners(): drag, Space + move, and wheel input on the drawing
let pointer: PointerInput;

// mounted in main() before any listener that zooms is attached
let hud: HudHandle;

// current settings; replaced from storage in main() and kept live by onSettingsChanged
let settings: Settings = { ...DEFAULT_SETTINGS };

// how long the view must rest before the URL's view link is rewritten
const VIEW_LINK_DELAY_MS = 300;
let maybeViewLinkTimer: ReturnType<typeof setTimeout> | undefined;

// for the debug card
let lastPointer: Point = { x: 0, y: 0 };
let maybeLastWheel: WheelSample | null = null;
// the SVG as authored, captured in main() before its size attributes are rewritten
let documentFacts: DocumentFacts;

main().catch((error: unknown) => {
    console.error('SVG Navigator: failed to start', error);
});

async function main(): Promise<void> {
    const maybeSvgRoot = maybeGetStandaloneSvgRoot();
    if(!maybeSvgRoot) { return; }

    // The popup's per-tab off switch (#55): answer it even while off, so it can turn us back on.
    const pageState = readPageState();
    listenForPageSwitch(pageState);
    if(!pageState.enabled) {
        // Marks the untouched SVG, so E2E tests can wait on it.
        maybeSvgRoot.dataset.svgNavigator = 'off';
        return;
    }

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
    // Read before the code below strips sizes and inserts the zoom rectangle.
    const authored = readAuthoredFacts(svgDocument);

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

    // keep aspect ratio; just remove attribute if it exists
    svgDocument.removeAttribute('preserveAspectRatio');

    // the authored size in pixels, which sizes the view when there's no viewBox (#9)
    const authoredWidth = lengthToPixels(svgDocument.getAttribute('width'), getWidth());
    const authoredHeight = lengthToPixels(svgDocument.getAttribute('height'), getHeight());
    // make width and height 100% to fill client web browser
    svgDocument.setAttribute('width', '100%');
    svgDocument.setAttribute('height', '100%');

    const maybeAuthoredViewBox = maybeParseViewBox(svgDocument.getAttribute('viewBox') ?? '');
    if(!maybeAuthoredViewBox) {
        console.warn('SVG Navigator: warning: SVG had no usable viewBox attribute. Making one from its size.');
    }
    // preferably, a missing viewbox would be the bounding box of the SVG from getBBox();
    // unfortunatley, chrome's getBBox() is bugged for some SVG documents, ex: http://upload.wikimedia.org/wikipedia/commons/d/dc/USA_orthographic.svg
    // so the viewbox starts at 0,0 with the SVG's width and height
    const authoredViewBox = maybeAuthoredViewBox ?? { x: 0, y: 0, width: authoredWidth, height: authoredHeight };
    documentFacts = {
        ...authored,
        viewBox: authoredViewBox,
        viewBoxSource: maybeAuthoredViewBox ? 'authored' : 'derivedFromSize',
    };
    // match the window's aspect ratio, so the whole drawing shows, centered
    originalViewBox = fitToAspectRatio(authoredViewBox, getWidth()/getHeight());
    viewBox = maybeLinkedView(location.hash) ?? originalViewBox;
    svgDocument.setAttribute('viewBox', formatViewBox(viewBox));

    settings = await loadSettingsOrDefaults();
    hud = mountHud(htmlDoc, {
        actions: { zoomIn: () => zoomBy(0.8), zoomOut: () => zoomBy(1.25), reset: resetViewBox },
        toolbarEnabled: settings.toolbarEnabled,
        position: settings.toolbarPosition,
        autoHide: settings.toolbarAutoHide,
        savedBackground: settings.svgBackgroundColor,
        drawing: svgDocument,
        clickAndDragBehavior: settings.clickAndDragBehavior,
    });
    addEventListeners();
    refreshHud();
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

function onSettingsChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string): void {
    if(areaName !== 'sync') { return; }
    for (const [key, { newValue }] of Object.entries(changes)) {
        if(!isSettingKey(key)) { continue; }
        settings = parseSettings({ ...settings, [key]: newValue });
        applySetting(key);
    }
}

// Settings without a case here take effect on the next page load.
function applySetting(key: SettingKey): void {
    switch(key) {
    case 'showDebugInfo':
    case 'clickAndDragBehavior':
    case 'scrollSensitivity':
    case 'invertScroll':
        refreshHud();
        break;
    case 'svgBackgroundColor':
        hud.setSavedBackground(settings.svgBackgroundColor);
        break;
    case 'toolbarEnabled':
        hud.setToolbarEnabled(settings.toolbarEnabled);
        break;
    case 'toolbarPosition':
        hud.setPosition(settings.toolbarPosition);
        break;
    case 'toolbarAutoHide':
        hud.setAutoHide(settings.toolbarAutoHide);
        break;
    default:
        break;
    }
}

function trackPointer(evt: MouseEvent): void {
    lastPointer = { x: evt.clientX, y: evt.clientY };
    if(settings.showDebugInfo) { refreshHud(); }
}

function addEventListeners(): void {
    // event listeners
    document.addEventListener('keydown', onKey, false);
    document.addEventListener('keyup', onKey, false);
    pointer = attachPointerInput({
        svg: svgDocument,
        clickAndDragBehavior: settings.clickAndDragBehavior,
        view: () => viewBox,
        showViewBox,
        wheelSettings: () => ({ sensitivity: settings.scrollSensitivity, invert: settings.invertScroll }),
        onInteractionChange: () => { if(settings.showDebugInfo) { refreshHud(); } },
        onWheel: (sample) => { maybeLastWheel = sample; },
    });
    // A link's view can also change in place: an edited fragment, or a link within the page.
    window.addEventListener('hashchange', () => {
        const maybeView = maybeLinkedView(location.hash);
        if(maybeView) { showViewBox(maybeView); }
    });
    // The readout compares views as displayed, which depends on the window's shape.
    window.addEventListener('resize', refreshHud);
    document.addEventListener('mousemove', trackPointer, false);
}

// The bindings live in input/keyActions.ts; this runs whichever action a key triggers.
// A bound key is consumed, so Ctrl/⌘ + = zooms the drawing rather than the whole page.
function onKey(evt: KeyboardEvent): void {
    const { type, key, code, ctrlKey, metaKey, altKey, shiftKey } = evt;
    if(type !== 'keydown' && type !== 'keyup') { return; }
    const maybeAction = keyAction({ type, key, code, ctrlKey, metaKey, altKey, shiftKey });
    if(maybeAction === null) { return; }
    evt.preventDefault();
    runKeyAction(maybeAction);
}

function runKeyAction(action: KeyAction): void {
    switch(action.kind) {
    case 'panStart':
        pointer.beginSpacePan();
        return;
    case 'panEnd':
        pointer.endSpacePan();
        return;
    case 'toggleFullscreen':
        hud.toggleFullscreen();
        return;
    case 'toggleShortcuts':
        hud.toggleShortcuts();
        return;
    default:
        break;
    }
    // view changes never interrupt a pan or a zoom box
    if(pointer.isBusy()) { return; }
    switch(action.kind) {
    case 'zoomIn':
        zoomBy(0.8);
        return;
    case 'zoomOut':
        zoomBy(1.25);
        return;
    case 'reset':
        resetViewBox();
        return;
    case 'nudge':
        showViewBox(nudgeViewBox(viewBox, action.dx, action.dy));
        return;
    }
}

// below 1 zooms in, above 1 zooms out
function zoomBy(zoomAmount: number): void {
    showViewBox(zoomAroundCenter(viewBox, zoomAmount));
}

function resetViewBox(): void {
    showViewBox(originalViewBox);
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

// Every view change goes through here. A step the browser can't show is ignored, so
// zooming stops at the deepest usable view instead of breaking it (#23).
function showViewBox(next: ViewBox): void {
    if(!isRepresentableViewBox(next)) { return; }
    viewBox = next;
    setViewBox();
}

function setViewBox(): void {
    svgDocument.setAttribute('viewBox', formatViewBox(viewBox));
    refreshHud();
    scheduleViewLinkUpdate();
}

// The view a #svgView(...) link names, fitted to this window's shape (#49).
function maybeLinkedView(hash: string): ViewBox | null {
    const maybeView = maybeParseSvgViewFragment(hash);
    if(!maybeView) { return null; }
    const fitted = fitToAspectRatio(maybeView, getWidth()/getHeight());
    return isRepresentableViewBox(fitted) ? fitted : null;
}

// Keeps the current view in the URL, without adding history entries, once the view
// rests. The whole drawing needs no link, and another fragment belongs to the SVG.
function scheduleViewLinkUpdate(): void {
    if(!ownsFragment(location.hash)) { return; }
    clearTimeout(maybeViewLinkTimer);
    maybeViewLinkTimer = setTimeout(() => {
        const url = new URL(location.href);
        url.hash = isSameView(viewBox, originalViewBox) ? '' : formatSvgViewFragment(viewBox);
        history.replaceState(history.state, '', url.href);
    }, VIEW_LINK_DELAY_MS);
}

function isSameView(a: ViewBox, b: ViewBox): boolean {
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function refreshHud(): void {
    hud.setZoom(currentZoom());
    hud.setDebugInfo(settings.showDebugInfo ? collectDebugInfo() : null);
}

function currentZoom(): number {
    return displayedZoom(originalViewBox, viewBox, getWidth()/getHeight());
}

// @since 2.6
// The navigator takes over standalone SVG documents, whatever their URL (extension or
// none), and never HTML pages with inline SVG.
function maybeGetStandaloneSvgRoot(): SVGSVGElement | null {
    const root = document.documentElement;
    return root instanceof SVGSVGElement ? root : null;
}

function readAuthoredFacts(svg: SVGSVGElement): Omit<DocumentFacts, 'viewBox' | 'viewBoxSource'> {
    return {
        authoredWidth: svg.getAttribute('width'),
        authoredHeight: svg.getAttribute('height'),
        authoredPreserveAspectRatio: svg.getAttribute('preserveAspectRatio'),
        elementCount: svg.querySelectorAll('*').length,
    };
}

function collectDebugInfo(): DebugInfo {
    const svgPoint = clientToSvgPoint(svgDocument, lastPointer.x, lastPointer.y, svgDocument);
    return {
        viewBox,
        zoomRatio: currentZoom(),
        pointer: { client: lastPointer, svg: { x: svgPoint.x, y: svgPoint.y }, maybeElement: summarizeElementAt(lastPointer) },
        document: documentFacts,
        input: {
            interaction: pointer.interactionKind(),
            maybeLastWheel,
            clickAndDragBehavior: settings.clickAndDragBehavior,
            scrollSensitivity: settings.scrollSensitivity,
            invertScroll: settings.invertScroll,
        },
        environment: {
            browser: describeBrowser(navigator.userAgent, maybeUserAgentBrands()),
            devicePixelRatio: window.devicePixelRatio,
            windowWidth: getWidth(),
            windowHeight: getHeight(),
        },
        build: { version: getVersion(), maybeCommit: BUILD_INFO.maybeCommit, timestamp: BUILD_INFO.timestamp },
    };
}

// The zoom rectangle and the HUD sit over the artwork; report what's beneath them.
function summarizeElementAt({ x, y }: Point): ElementSummary | null {
    const maybeElement = document.elementsFromPoint(x, y)
        .find((element) => !pointer.isZoomRectangle(element) && element.localName !== HUD_HOST_TAG);
    if(!maybeElement) { return null; }
    return { localName: maybeElement.localName, id: maybeElement.id, classNames: [...maybeElement.classList] };
}

// Client hints exist only in Chromium, and TypeScript's DOM types don't include them yet.
function maybeUserAgentBrands(): readonly UaBrand[] | null {
    const maybeData = (navigator as Navigator & { userAgentData?: { brands: readonly UaBrand[] } }).userAgentData;
    return maybeData?.brands ?? null;
}

function getVersion(): string {
    return chrome.runtime.getManifest().version;
}
