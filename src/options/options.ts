/**
 * The toolbar popup: shows the user's settings, saves each change to
 * `chrome.storage.sync`, and the content script picks it up from there.
 */

import { BUILD_TIMESTAMP } from '../js/buildInfo';
import {
    DEFAULT_SETTINGS,
    SCROLL_SENSITIVITY_RANGE,
    loadSettings,
    parseSetting,
    saveSetting,
    type SettingKey,
    type Settings,
} from '../shared/settings';

type BooleanSettingKey = { [K in SettingKey]: Settings[K] extends boolean ? K : never }[SettingKey];

const CHECKBOX_KEYS = ['invertScroll', 'toolbarAutoHide', 'toolbarEnabled', 'showDebugInfo'] as const satisfies readonly BooleanSettingKey[];

function requireElement<T extends HTMLElement>(id: string, type: new () => T): T {
    const element = document.getElementById(id);
    if (!(element instanceof type)) {
        throw new Error(`Options page is missing #${id}`);
    }
    return element;
}

const controls = {
    clickAndDragBehavior: requireElement('clickAndDragBehavior', HTMLSelectElement),
    scrollSensitivity: requireElement('scrollSensitivity', HTMLInputElement),
    scrollSensitivityValue: requireElement('scrollSensitivityValue', HTMLOutputElement),
    svgBackgroundColor: requireElement('svgBackgroundColor', HTMLInputElement),
    svgBackgroundColorSwatch: requireElement('svgBackgroundColorSwatch', HTMLSpanElement),
    resetBehaviors: requireElement('resetBehaviors', HTMLButtonElement),
    resetBackgroundColor: requireElement('resetBackgroundColor', HTMLButtonElement),
    status: requireElement('status', HTMLParagraphElement),
    versionInfo: requireElement('versionInfo', HTMLElement),
    checkboxes: Object.fromEntries(
        CHECKBOX_KEYS.map((key) => [key, requireElement(key, HTMLInputElement)]),
    ) as Record<BooleanSettingKey, HTMLInputElement>,
};

function render(settings: Settings): void {
    controls.clickAndDragBehavior.value = settings.clickAndDragBehavior;
    controls.scrollSensitivity.value = String(settings.scrollSensitivity);
    renderScrollSensitivityValue();
    for (const key of CHECKBOX_KEYS) {
        controls.checkboxes[key].checked = settings[key];
    }
    controls.svgBackgroundColor.value = settings.svgBackgroundColor;
    renderBackgroundColorValidity();
}

function renderScrollSensitivityValue(): void {
    controls.scrollSensitivityValue.value = controls.scrollSensitivity.value;
}

function isValidCssColor(value: string): boolean {
    return CSS.supports('color', value);
}

function renderBackgroundColorValidity(): void {
    const value = controls.svgBackgroundColor.value.trim();
    const isValid = isValidCssColor(value);
    controls.svgBackgroundColor.setAttribute('aria-invalid', String(!isValid));
    controls.svgBackgroundColorSwatch.style.background = isValid ? value : 'transparent';
}

function showError(error: unknown): void {
    console.error('SVG Navigator: could not save settings', error);
    controls.status.textContent = `Could not save settings: ${error instanceof Error ? error.message : String(error)}`;
}

/** Saves one setting, surfacing a failure on the page instead of dropping it. */
function save<K extends SettingKey>(key: K, value: Settings[K]): void {
    controls.status.textContent = '';
    saveSetting(key, value).catch(showError);
}

async function resetToDefaults(keys: readonly SettingKey[]): Promise<void> {
    const defaults = Object.fromEntries(keys.map((key) => [key, DEFAULT_SETTINGS[key]]));
    controls.status.textContent = '';
    await chrome.storage.sync.set(defaults);
    render(await loadSettings());
}

function addEventListeners(): void {
    controls.clickAndDragBehavior.addEventListener('change', () => {
        save('clickAndDragBehavior', parseSetting('clickAndDragBehavior', controls.clickAndDragBehavior.value));
    });

    controls.scrollSensitivity.addEventListener('input', renderScrollSensitivityValue);
    // `change` fires once the slider is released, so dragging doesn't flood storage.
    controls.scrollSensitivity.addEventListener('change', () => {
        save('scrollSensitivity', controls.scrollSensitivity.valueAsNumber);
    });

    for (const key of CHECKBOX_KEYS) {
        const checkbox = controls.checkboxes[key];
        checkbox.addEventListener('change', () => save(key, checkbox.checked));
    }

    // Saved immediately rather than debounced: the popup is destroyed as soon as it loses
    // focus, and a write started while it unloads may never land. Only complete, valid
    // colors are saved, which keeps writes well under sync storage's per-minute quota.
    controls.svgBackgroundColor.addEventListener('input', () => {
        renderBackgroundColorValidity();
        const value = controls.svgBackgroundColor.value.trim();
        if (isValidCssColor(value)) {
            save('svgBackgroundColor', value);
        }
    });

    controls.resetBehaviors.addEventListener('click', () => {
        resetToDefaults(['clickAndDragBehavior', 'scrollSensitivity', 'invertScroll']).catch(showError);
    });
    controls.resetBackgroundColor.addEventListener('click', () => {
        resetToDefaults(['svgBackgroundColor']).catch(showError);
    });
}

function setUpTabs(): void {
    const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const select = (selected: HTMLButtonElement): void => {
        for (const tab of tabs) {
            const isSelected = tab === selected;
            tab.setAttribute('aria-selected', String(isSelected));
            tab.tabIndex = isSelected ? 0 : -1;
            const panelId = tab.getAttribute('aria-controls');
            const panel = panelId ? document.getElementById(panelId) : null;
            if (panel) { panel.hidden = !isSelected; }
        }
    };
    for (const tab of tabs) {
        tab.addEventListener('click', () => select(tab));
    }
}

function renderVersionInfo(): void {
    const version = chrome.runtime.getManifest().version;
    controls.versionInfo.textContent = `Version ${version} · Built ${BUILD_TIMESTAMP}`;
}

async function init(): Promise<void> {
    controls.scrollSensitivity.min = String(SCROLL_SENSITIVITY_RANGE.min);
    controls.scrollSensitivity.max = String(SCROLL_SENSITIVITY_RANGE.max);
    controls.scrollSensitivity.step = String(SCROLL_SENSITIVITY_RANGE.step);
    setUpTabs();
    renderVersionInfo();
    render(await loadSettings());
    addEventListeners();
    // Lets E2E tests wait until stored settings are shown and changes are saved.
    document.documentElement.dataset.optionsReady = 'true';
}

init().catch((error: unknown) => {
    console.error('SVG Navigator: options page failed to load', error);
    controls.status.textContent = 'Could not load settings.';
});
