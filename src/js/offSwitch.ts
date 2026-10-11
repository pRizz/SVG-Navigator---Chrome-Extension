/**
 * The content script's side of the popup's per-tab off switch (#55). The choice lives
 * in this tab's sessionStorage, so it survives the reload that applies it and stays
 * with this tab. Turning it off reloads to the untouched SVG; turning it on reloads
 * to the navigator. The HUD's Export menu can turn it off too.
 */

import { isPageSwitchMessage, pageOffKey, type PageState } from '../shared/pageSwitch';

/** This page's state; a site that blocks sessionStorage can't be switched off. */
export function readPageState(): PageState {
    try {
        return { enabled: sessionStorage.getItem(pageOffKey(location.href)) === null, canToggle: true };
    } catch (error) {
        console.warn('SVG Navigator: this site blocks sessionStorage, so the per-tab off switch is unavailable', error);
        return { enabled: true, canToggle: false };
    }
}

/** Answers the popup: reports `state`, or records a change and reloads to apply it. */
export function listenForPageSwitch(state: PageState): void {
    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
        if (!isPageSwitchMessage(message)) {
            return false;
        }
        if (message.type === 'getPageState' || !state.canToggle || message.enabled === state.enabled) {
            sendResponse(state);
            return false;
        }
        storeEnabled(message.enabled);
        sendResponse({ ...state, enabled: message.enabled });
        // After the reply is on its way, so the popup hears back before the page unloads.
        setTimeout(() => location.reload(), 0);
        return false;
    });
}

/** The HUD's "Show the original SVG": turns the navigator off in this tab and reloads to the untouched SVG. */
export function showOriginalSvg(): void {
    storeEnabled(false);
    location.reload();
}

function storeEnabled(enabled: boolean): void {
    const key = pageOffKey(location.href);
    if (enabled) {
        sessionStorage.removeItem(key);
    } else {
        sessionStorage.setItem(key, 'true');
    }
}
