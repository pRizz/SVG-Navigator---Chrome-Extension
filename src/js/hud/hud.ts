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
import { IDLE_HIDE_MS, initialVisibility, isVisible, reduceVisibility, withAutoHide, type VisibilityEvent } from './visibility';
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
    autoHide: boolean;
}

export interface HudHandle {
    setZoom: (ratio: number) => void;
    setToolbarEnabled: (enabled: boolean) => void;
    setPosition: (position: ToolbarPosition) => void;
    setAutoHide: (autoHide: boolean) => void;
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

    let visibility = initialVisibility(options.autoHide);
    let maybeIdleTimer: ReturnType<typeof setTimeout> | undefined;

    function dispatch(event: VisibilityEvent): void {
        visibility = reduceVisibility(visibility, event);
        renderVisibility();
    }

    function renderVisibility(): void {
        dock.toggleAttribute('data-hidden', !isVisible(visibility));
    }

    function restartIdleTimer(): void {
        clearTimeout(maybeIdleTimer);
        maybeIdleTimer = setTimeout(() => dispatch('idleElapsed'), IDLE_HIDE_MS);
    }

    function onActivity(): void {
        dispatch('activity');
        restartIdleTimer();
    }

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
    for (const type of ['mousemove', 'wheel', 'keydown'] as const) {
        document.addEventListener(type, onActivity, { passive: true, signal });
    }
    dock.addEventListener('pointerenter', () => dispatch('pointerEnter'), { signal });
    dock.addEventListener('pointerleave', () => dispatch('pointerLeave'), { signal });
    // Only keyboard focus pins the HUD: a mouse click also focuses its button, and that
    // must not keep the HUD up once the pointer leaves.
    root.addEventListener('focusin', (event) => {
        const maybeTarget = event.composedPath()[0];
        if (maybeTarget instanceof Element && maybeTarget.matches(':focus-visible')) {
            dispatch('focusIn');
        }
    }, { signal });
    root.addEventListener('focusout', (event) => {
        const maybeNext = event instanceof FocusEvent ? event.relatedTarget : null;
        if (!(maybeNext instanceof Node && dock.contains(maybeNext))) {
            dispatch('focusOut');
        }
    }, { signal });

    setPosition(options.position);
    setToolbarEnabled(options.toolbarEnabled);
    renderVisibility();
    restartIdleTimer();

    return {
        setZoom: (ratio) => pill.setZoomLabel(zoomLabel(ratio)),
        setToolbarEnabled,
        setPosition,
        setAutoHide: (autoHide) => {
            visibility = withAutoHide(visibility, autoHide);
            renderVisibility();
            restartIdleTimer();
        },
        destroy: () => {
            listeners.abort();
            clearTimeout(maybeIdleTimer);
            host.remove();
        },
    };
}

function isButton(maybeTarget: EventTarget | undefined): boolean {
    return maybeTarget instanceof Element && maybeTarget.localName === 'button';
}
