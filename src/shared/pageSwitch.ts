/**
 * The popup's per-tab off switch (#55): the messages the popup sends to an SVG tab's
 * content script, the key the choice is stored under in that tab's sessionStorage,
 * and how the popup shows the switch. Pure; shared by both sides.
 */

export type PageSwitchMessage =
    | { type: 'getPageState' }
    | { type: 'setPageEnabled', enabled: boolean };

/** A content script's answer to `getPageState`. */
export interface PageState {
    enabled: boolean;
    /** False where the site blocks sessionStorage, so the choice couldn't survive the reload. */
    canToggle: boolean;
}

export interface PageSwitchView {
    checked: boolean;
    disabled: boolean;
    hint: string;
}

/** The sessionStorage key for a page; view links (`#svgView(...)`) share their page's key. */
export function pageOffKey(href: string): string {
    const url = new URL(href);
    url.hash = '';
    return `svg-navigator:off:${url.href}`;
}

export function isPageSwitchMessage(value: unknown): value is PageSwitchMessage {
    if (typeof value !== 'object' || value === null || !('type' in value)) {
        return false;
    }
    if (value.type === 'getPageState') {
        return true;
    }
    return value.type === 'setPageEnabled' && 'enabled' in value && typeof value.enabled === 'boolean';
}

/** Whether a content script's reply is a `PageState`; anything else counts as no reply. */
export function isPageState(value: unknown): value is PageState {
    return typeof value === 'object' && value !== null
        && 'enabled' in value && typeof value.enabled === 'boolean'
        && 'canToggle' in value && typeof value.canToggle === 'boolean';
}

/**
 * How the popup shows the switch, given the active tab's state; `null` (the tab isn't
 * an SVG the navigator runs on) hides it, since it can't apply there.
 */
export function pageSwitchView(maybeState: PageState | null): PageSwitchView | null {
    if (maybeState === null) {
        return null;
    }
    if (!maybeState.canToggle) {
        return { checked: maybeState.enabled, disabled: true, hint: 'This site blocks the storage this needs; turn the extension off instead' };
    }
    return maybeState.enabled
        ? { checked: true, disabled: false, hint: 'Turn off to see the original SVG' }
        : { checked: false, disabled: false, hint: 'Off for this page in this tab' };
}
