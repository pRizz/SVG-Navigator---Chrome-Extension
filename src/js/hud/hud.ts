/**
 * The heads-up display over a navigated SVG: a control pill pinned to a window edge or
 * corner, its shortcuts popover, and the per-tab background cycle, all inside one
 * shadow root so page styles can't reach them and their styles can't reach the page.
 * `svgNavigator.ts` drives it through the returned `HudHandle`.
 */

import type { ClickAndDragBehavior, ToolbarPosition } from '../../shared/settings';
import { mountDebugCard, type DebugCard } from './debugCard';
import type { DebugInfo } from './debugInfo';
import { backgroundButtonTitle, backgroundCss, nextBackground, type BackgroundState } from './backgroundCycle';
import { hudLayout } from './layout';
import { createPill } from './pill';
import { createShadowHost } from './shadowHost';
import { createShortcutsPopover, shortcutRows } from './shortcuts';
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
    savedBackground: string;
    /** Fixed for the page's lifetime: the navigator binds drag behavior once, at load. */
    clickAndDragBehavior: ClickAndDragBehavior;
}

export interface HudHandle {
    setZoom: (ratio: number) => void;
    setToolbarEnabled: (enabled: boolean) => void;
    setPosition: (position: ToolbarPosition) => void;
    setAutoHide: (autoHide: boolean) => void;
    setSavedBackground: (color: string) => void;
    setDebugInfo: (maybeInfo: DebugInfo | null) => void;
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

    let background: BackgroundState = 'saved';
    let savedBackground = options.savedBackground;
    let visibility = initialVisibility(options.autoHide);
    let maybeIdleTimer: ReturnType<typeof setTimeout> | undefined;
    let position = options.position;
    let maybeDebugCard: DebugCard | null = null;

    const popover = createShortcutsPopover(htmlDoc, shortcutRows(options.clickAndDragBehavior, navigator.userAgent.includes('Mac')));
    const pill = createPill(htmlDoc, {
        ...options.actions,
        cycleBackground: () => {
            background = nextBackground(background);
            applyBackground();
        },
        toggleFullscreen,
        toggleShortcuts: () => setShortcutsOpen(!popover.isOpen()),
    }, { fullscreenEnabled: document.fullscreenEnabled });
    const dock = htmlDoc.createElement('div');
    dock.className = 'dock';
    dock.append(pill.element, popover.element);

    function applyBackground(): void {
        document.body.style.background = backgroundCss(background, savedBackground);
        pill.setBackgroundTitle(backgroundButtonTitle(background));
    }

    function toggleFullscreen(): void {
        const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
        request.catch((error: unknown) => {
            console.warn('SVG Navigator: full screen request failed', error);
        });
    }

    function setShortcutsOpen(open: boolean): void {
        popover.setOpen(open);
        pill.setShortcutsExpanded(open);
        dispatch(open ? 'popoverOpen' : 'popoverClose');
    }

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

    function setPosition(next: ToolbarPosition): void {
        const layout = hudLayout(next);
        position = next;
        dock.dataset.position = next;
        pill.element.dataset.orientation = layout.orientation;
        popover.element.dataset.direction = layout.popoverDirection;
        maybeDebugCard?.setCorner(layout.debugCorner);
    }

    function setToolbarEnabled(enabled: boolean): void {
        if (enabled) {
            root.append(dock);
            return;
        }
        if (popover.isOpen()) {
            setShortcutsOpen(false);
        }
        dock.remove();
    }

    // A focused button activates on Space; the navigator must not also start a spacebar pan.
    root.addEventListener('keydown', (event) => {
        if (event instanceof KeyboardEvent && event.key === ' ' && isButton(event.composedPath()[0])) {
            event.stopPropagation();
        }
    }, { signal });
    // Capture phase, so an Escape that closes the popover never reaches the navigator's
    // own Escape (reset the view), whichever element has focus. Focus stays where it was:
    // a keyboard user is still on `?`, and moving a mouse user there would make the next
    // Space reopen the list instead of panning.
    document.addEventListener('keyup', (event) => {
        if (event.key !== 'Escape' || !popover.isOpen()) { return; }
        event.stopPropagation();
        setShortcutsOpen(false);
    }, { capture: true, signal });
    document.addEventListener('pointerdown', (event) => {
        if (popover.isOpen() && !event.composedPath().includes(dock)) {
            setShortcutsOpen(false);
        }
    }, { capture: true, signal });
    document.addEventListener('fullscreenchange', () => pill.setFullscreen(document.fullscreenElement !== null), { signal });
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
    applyBackground();
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
        setSavedBackground: (color) => {
            savedBackground = color;
            background = 'saved';
            applyBackground();
        },
        setDebugInfo: (maybeInfo) => {
            if (maybeInfo === null) {
                maybeDebugCard?.remove();
                maybeDebugCard = null;
                return;
            }
            maybeDebugCard ??= mountDebugCard(htmlDoc, root, hudLayout(position).debugCorner);
            maybeDebugCard.render(maybeInfo);
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
