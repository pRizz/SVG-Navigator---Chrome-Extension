/**
 * The toolbar popup: shows the user's settings, saves each change to
 * `chrome.storage.sync`, and the content script picks it up from there.
 */

import { BUILD_INFO } from '../js/buildInfo';
import { provenanceFields, type ProvenanceField } from '../shared/provenance';
import {
    DEFAULT_SETTINGS,
    SCROLL_SENSITIVITY_RANGE,
    SETTING_KEYS,
    loadSettings,
    parseSetting,
    saveSetting,
    type SettingKey,
    type Settings,
} from '../shared/settings';
import { isPageState, pageSwitchView, type PageState, type PageSwitchMessage } from '../shared/pageSwitch';
import { shortcutRows, type ShortcutPart } from '../shared/shortcuts';

type BooleanSettingKey = { [K in SettingKey]: Settings[K] extends boolean ? K : never }[SettingKey];

const SWITCH_KEYS = ['invertScroll', 'toolbarAutoHide', 'toolbarEnabled', 'showDebugInfo'] as const satisfies readonly BooleanSettingKey[];

const SAVED_NOTICE_MS = 1_500;
const RESET_CONFIRM_MS = 4_000;

function requireElement<T extends HTMLElement>(id: string, type: new () => T): T {
    const element = document.getElementById(id);
    if (!(element instanceof type)) {
        throw new Error(`Options page is missing #${id}`);
    }
    return element;
}

const controls = {
    clickAndDragOptions: [...document.querySelectorAll<HTMLInputElement>('input[name="clickAndDragBehavior"]')],
    toolbarPositionOptions: [...document.querySelectorAll<HTMLInputElement>('input[name="toolbarPosition"]')],
    scrollSensitivity: requireElement('scrollSensitivity', HTMLInputElement),
    scrollSensitivityValue: requireElement('scrollSensitivityValue', HTMLOutputElement),
    svgBackgroundColor: requireElement('svgBackgroundColor', HTMLInputElement),
    svgBackgroundColorSwatch: requireElement('svgBackgroundColorSwatch', HTMLSpanElement),
    colorPresets: [...document.querySelectorAll<HTMLButtonElement>('.preset')],
    resetAll: requireElement('resetAll', HTMLButtonElement),
    status: requireElement('status', HTMLSpanElement),
    versionInfo: requireElement('versionInfo', HTMLElement),
    controls: requireElement('controls', HTMLDivElement),
    pageCard: requireElement('page-card', HTMLDivElement),
    pageEnabled: requireElement('pageEnabled', HTMLInputElement),
    pageEnabledHint: requireElement('pageEnabledHint', HTMLSpanElement),
    switches: Object.fromEntries(
        SWITCH_KEYS.map((key) => [key, requireElement(key, HTMLInputElement)]),
    ) as Record<BooleanSettingKey, HTMLInputElement>,
};

function render(settings: Settings): void {
    for (const option of controls.clickAndDragOptions) {
        option.checked = option.value === settings.clickAndDragBehavior;
    }
    for (const option of controls.toolbarPositionOptions) {
        option.checked = option.value === settings.toolbarPosition;
    }
    controls.scrollSensitivity.value = String(settings.scrollSensitivity);
    renderScrollSensitivityValue();
    for (const key of SWITCH_KEYS) {
        controls.switches[key].checked = settings[key];
    }
    renderToolbarDependencies();
    controls.svgBackgroundColor.value = settings.svgBackgroundColor;
    renderBackgroundColor();
}

function renderScrollSensitivityValue(): void {
    controls.scrollSensitivityValue.value = controls.scrollSensitivity.value;
}

// Auto-hide and position only matter while the toolbar is shown.
function renderToolbarDependencies(): void {
    const isToolbarOff = !controls.switches.toolbarEnabled.checked;
    controls.switches.toolbarAutoHide.disabled = isToolbarOff;
    for (const option of controls.toolbarPositionOptions) {
        option.disabled = isToolbarOff;
    }
}

function isValidCssColor(value: string): boolean {
    return CSS.supports('color', value);
}

function renderBackgroundColor(): void {
    const value = controls.svgBackgroundColor.value.trim();
    const isValid = isValidCssColor(value);
    controls.svgBackgroundColor.setAttribute('aria-invalid', String(!isValid));
    controls.svgBackgroundColorSwatch.style.setProperty('--swatch-color', isValid ? value : 'transparent');
    for (const preset of controls.colorPresets) {
        preset.setAttribute('aria-pressed', String(preset.dataset.color === value.toLowerCase()));
    }
}

let maybeStatusTimer: ReturnType<typeof setTimeout> | undefined;

function showSaved(): void {
    clearTimeout(maybeStatusTimer);
    controls.status.textContent = '✓ Saved';
    controls.status.dataset.state = 'saved';
    maybeStatusTimer = setTimeout(() => {
        delete controls.status.dataset.state;
    }, SAVED_NOTICE_MS);
}

function showError(error: unknown): void {
    console.error('SVG Navigator: could not save settings', error);
    clearTimeout(maybeStatusTimer);
    controls.status.textContent = `Could not save: ${error instanceof Error ? error.message : String(error)}`;
    controls.status.dataset.state = 'error';
}

/** Saves one setting, confirming success or surfacing a failure on the page. */
function save<K extends SettingKey>(key: K, value: Settings[K]): void {
    saveSetting(key, value).then(showSaved, showError);
}

async function resetToDefaults(keys: readonly SettingKey[]): Promise<void> {
    const defaults = Object.fromEntries(keys.map((key) => [key, DEFAULT_SETTINGS[key]]));
    await chrome.storage.sync.set(defaults);
    render(await loadSettings());
    showSaved();
}

// Saved immediately rather than debounced: the popup is destroyed as soon as it loses
// focus, and a write started while it unloads may never land. Only complete, valid
// colors are saved, which keeps writes well under sync storage's per-minute quota.
function saveBackgroundColorIfValid(): void {
    renderBackgroundColor();
    const value = controls.svgBackgroundColor.value.trim();
    if (isValidCssColor(value)) {
        save('svgBackgroundColor', value);
    }
}

/** Resetting everything is destructive enough to need a second click within a few seconds. */
function setUpResetAll(): void {
    const button = controls.resetAll;
    const idleLabel = button.textContent ?? '';
    let maybeConfirmTimer: ReturnType<typeof setTimeout> | undefined;
    const disarm = (): void => {
        clearTimeout(maybeConfirmTimer);
        delete button.dataset.confirming;
        button.textContent = idleLabel;
    };
    button.addEventListener('click', () => {
        if (button.dataset.confirming !== 'true') {
            button.dataset.confirming = 'true';
            button.textContent = 'Click again to reset everything';
            maybeConfirmTimer = setTimeout(disarm, RESET_CONFIRM_MS);
            return;
        }
        disarm();
        resetToDefaults(SETTING_KEYS).catch(showError);
    });
}

function addEventListeners(): void {
    for (const option of controls.clickAndDragOptions) {
        option.addEventListener('change', () => {
            save('clickAndDragBehavior', parseSetting('clickAndDragBehavior', option.value));
        });
    }

    for (const option of controls.toolbarPositionOptions) {
        option.addEventListener('change', () => {
            save('toolbarPosition', parseSetting('toolbarPosition', option.value));
        });
    }

    controls.scrollSensitivity.addEventListener('input', renderScrollSensitivityValue);
    // `change` fires once the slider is released, so dragging doesn't flood storage.
    controls.scrollSensitivity.addEventListener('change', () => {
        save('scrollSensitivity', controls.scrollSensitivity.valueAsNumber);
    });

    for (const key of SWITCH_KEYS) {
        const toggle = controls.switches[key];
        toggle.addEventListener('change', () => save(key, toggle.checked));
    }
    controls.switches.toolbarEnabled.addEventListener('change', renderToolbarDependencies);

    controls.svgBackgroundColor.addEventListener('input', saveBackgroundColorIfValid);
    for (const preset of controls.colorPresets) {
        preset.addEventListener('click', () => {
            controls.svgBackgroundColor.value = preset.dataset.color ?? '';
            saveBackgroundColorIfValid();
        });
    }

    setUpResetAll();
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

/** Lists the shortcuts, both drag behaviors included, as the HUD's `?` popover does. */
function renderControls(): void {
    const rows = shortcutRows('either', navigator.userAgent.includes('Mac'));
    controls.controls.replaceChildren(...rows.map(({ action, parts }) => {
        const row = document.createElement('div');
        row.className = 'row';
        const label = document.createElement('span');
        label.className = 'row-label';
        label.textContent = action;
        const keys = document.createElement('span');
        keys.className = 'keys';
        keys.append(...parts.map(renderShortcutPart));
        row.append(label, keys);
        return row;
    }));
}

function renderShortcutPart(part: ShortcutPart): Node | string {
    if (typeof part === 'string') {
        return part;
    }
    const kbd = document.createElement('kbd');
    kbd.textContent = part.key;
    return kbd;
}

/** Shows which build this is, linking the commit and the CI run when known. */
function renderVersionInfo(): void {
    const fields = provenanceFields(chrome.runtime.getManifest().version, BUILD_INFO);
    controls.versionInfo.replaceChildren(...fields.flatMap((field, index) => [
        index === 0 ? '' : ' · ',
        `${field.label} `,
        renderFieldValue(field),
    ]));
}

function renderFieldValue({ text, maybeHref }: ProvenanceField): Node | string {
    if (maybeHref === null) {
        return text;
    }
    const link = document.createElement('a');
    link.href = maybeHref;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = text;
    return link;
}

/** The per-tab off switch (#55): asks the active tab's content script, if it has one. */
async function setUpPageSwitch(): Promise<void> {
    const [maybeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const maybeTabId = maybeTab?.id;
    if (maybeTabId === undefined) { return; }
    renderPageSwitch(await maybeAskPage(maybeTabId, { type: 'getPageState' }));
    controls.pageEnabled.addEventListener('change', () => {
        const message: PageSwitchMessage = { type: 'setPageEnabled', enabled: controls.pageEnabled.checked };
        maybeAskPage(maybeTabId, message).then(renderPageSwitch, showError);
    });
}

// A tab with no navigator (any page but an SVG) has no listener, so sendMessage rejects.
async function maybeAskPage(tabId: number, message: PageSwitchMessage): Promise<PageState | null> {
    try {
        const reply: unknown = await chrome.tabs.sendMessage(tabId, message);
        return isPageState(reply) ? reply : null;
    } catch {
        return null;
    }
}

function renderPageSwitch(maybeState: PageState | null): void {
    const maybeView = pageSwitchView(maybeState);
    controls.pageCard.hidden = maybeView === null;
    if (maybeView === null) { return; }
    controls.pageEnabled.checked = maybeView.checked;
    controls.pageEnabled.disabled = maybeView.disabled;
    controls.pageEnabledHint.textContent = maybeView.hint;
}

async function init(): Promise<void> {
    controls.scrollSensitivity.min = String(SCROLL_SENSITIVITY_RANGE.min);
    controls.scrollSensitivity.max = String(SCROLL_SENSITIVITY_RANGE.max);
    controls.scrollSensitivity.step = String(SCROLL_SENSITIVITY_RANGE.step);
    for (const preset of controls.colorPresets) {
        preset.style.setProperty('--swatch-color', preset.dataset.color ?? 'transparent');
    }
    setUpTabs();
    renderControls();
    renderVersionInfo();
    render(await loadSettings());
    addEventListeners();
    await setUpPageSwitch();
    // Lets E2E tests wait until stored settings are shown and changes are saved.
    document.documentElement.dataset.optionsReady = 'true';
}

init().catch((error: unknown) => {
    console.error('SVG Navigator: options page failed to load', error);
    controls.status.textContent = 'Could not load settings.';
    controls.status.dataset.state = 'error';
});
