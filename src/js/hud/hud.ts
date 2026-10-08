/**
 * The heads-up display over a navigated SVG: a control pill pinned to a window edge or
 * corner, inside one shadow root so page styles can't reach it and its styles can't
 * reach the page. `svgNavigator.ts` drives it through the returned `HudHandle`.
 */

import type { ToolbarPosition } from '../../shared/settings';
import { hudLayout } from './layout';
import { createPill } from './pill';
import { createShadowHost } from './shadowHost';
import { HUD_CSS } from './styles';
import { zoomLabel } from './zoomLabel';

export interface HudActions {
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
}

export interface HudOptions {
    actions: HudActions;
    toolbarEnabled: boolean;
    position: ToolbarPosition;
}

export interface HudHandle {
    setZoom: (ratio: number) => void;
    setToolbarEnabled: (enabled: boolean) => void;
    setPosition: (position: ToolbarPosition) => void;
    destroy: () => void;
}

/**
 * Mounts the HUD on `document.body`. `htmlDoc` creates the elements: in a standalone
 * SVG page `document` is an XML document whose `createElement` makes unstyled elements.
 */
export function mountHud(htmlDoc: Document, options: HudOptions): HudHandle {
    const { host, root } = createShadowHost(htmlDoc, document.body, HUD_CSS);
    const listeners = new AbortController();
    const { signal } = listeners;

    const pill = createPill(htmlDoc, options.actions);
    const dock = htmlDoc.createElement('div');
    dock.className = 'dock';
    dock.append(pill.element);

    function setPosition(position: ToolbarPosition): void {
        dock.dataset.position = position;
        pill.element.dataset.orientation = hudLayout(position).orientation;
    }

    function setToolbarEnabled(enabled: boolean): void {
        if (enabled) {
            root.append(dock);
        } else {
            dock.remove();
        }
    }

    // A focused button activates on Space; the navigator must not also start a spacebar pan.
    root.addEventListener('keydown', (event) => {
        if (event instanceof KeyboardEvent && event.key === ' ' && isButton(event.composedPath()[0])) {
            event.stopPropagation();
        }
    }, { signal });
    // The navigator only zooms on wheel events over the SVG; this stops the page scrolling.
    dock.addEventListener('wheel', (event) => event.preventDefault(), { passive: false, signal });

    setPosition(options.position);
    setToolbarEnabled(options.toolbarEnabled);

    return {
        setZoom: (ratio) => pill.setZoomLabel(zoomLabel(ratio)),
        setToolbarEnabled,
        setPosition,
        destroy: () => {
            listeners.abort();
            host.remove();
        },
    };
}

function isButton(maybeTarget: EventTarget | undefined): boolean {
    return maybeTarget instanceof Element && maybeTarget.localName === 'button';
}
