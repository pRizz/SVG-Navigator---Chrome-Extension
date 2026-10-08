/**
 * When the HUD shows, with auto-hide on: any activity wakes it, a quiet spell fades
 * it, and it stays up while the pointer is over it, keyboard focus is in it, or the
 * shortcuts popover is open. Pure; `hud.ts` owns the timer and the DOM.
 */

export const IDLE_HIDE_MS = 2_000;

export interface VisibilityState {
    autoHide: boolean;
    idle: boolean;
    hovered: boolean;
    focused: boolean;
    popoverOpen: boolean;
}

export type VisibilityEvent =
    | 'activity'
    | 'idleElapsed'
    | 'pointerEnter'
    | 'pointerLeave'
    | 'focusIn'
    | 'focusOut'
    | 'popoverOpen'
    | 'popoverClose';

export function initialVisibility(autoHide: boolean): VisibilityState {
    return { autoHide, idle: false, hovered: false, focused: false, popoverOpen: false };
}

export function reduceVisibility(state: VisibilityState, event: VisibilityEvent): VisibilityState {
    switch (event) {
    case 'activity':
        return { ...state, idle: false };
    case 'idleElapsed':
        return { ...state, idle: true };
    case 'pointerEnter':
        return { ...state, hovered: true };
    case 'pointerLeave':
        return { ...state, hovered: false };
    case 'focusIn':
        return { ...state, focused: true };
    case 'focusOut':
        return { ...state, focused: false };
    case 'popoverOpen':
        return { ...state, popoverOpen: true };
    case 'popoverClose':
        return { ...state, popoverOpen: false };
    }
}

/** Changing the setting counts as activity, so the HUD shows right away either way. */
export function withAutoHide(state: VisibilityState, autoHide: boolean): VisibilityState {
    return { ...state, autoHide, idle: false };
}

export function isVisible(state: VisibilityState): boolean {
    return !state.autoHide || !state.idle || state.hovered || state.focused || state.popoverOpen;
}
