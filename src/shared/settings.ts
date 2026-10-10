/**
 * User settings shared by the content script and the options popup. Each setting
 * is stored under its own key in `chrome.storage.sync`; a missing or malformed value
 * falls back to its default, so defaults never need to be written to storage.
 */

export type ClickAndDragBehavior = 'pan' | 'zoomBox';

/** Where the HUD sits: the four corners and the middle of each edge. */
export const TOOLBAR_POSITIONS = [
    'top-left', 'top', 'top-right',
    'left', 'right',
    'bottom-left', 'bottom', 'bottom-right',
] as const;

export type ToolbarPosition = typeof TOOLBAR_POSITIONS[number];

export interface Settings {
    clickAndDragBehavior: ClickAndDragBehavior;
    scrollSensitivity: number;
    invertScroll: boolean;
    toolbarAutoHide: boolean;
    toolbarEnabled: boolean;
    toolbarPosition: ToolbarPosition;
    /** The overview of the whole drawing shown while zoomed in (#48). */
    minimapEnabled: boolean;
    showDebugInfo: boolean;
    /** Any valid CSS color. */
    svgBackgroundColor: string;
}

export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Readonly<Settings> = {
    clickAndDragBehavior: 'pan',
    scrollSensitivity: 7,
    invertScroll: false,
    toolbarAutoHide: true,
    toolbarEnabled: true,
    toolbarPosition: 'bottom-right',
    minimapEnabled: true,
    showDebugInfo: false,
    svgBackgroundColor: 'white',
};

/** Bounds of the scroll sensitivity slider; zoom speed scales relative to `max`. */
export const SCROLL_SENSITIVITY_RANGE = { min: 0.01, max: 10, step: 0.01 } as const;

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const VALIDATORS: { [K in SettingKey]: (value: unknown) => value is Settings[K] } = {
    clickAndDragBehavior: (value): value is ClickAndDragBehavior => value === 'pan' || value === 'zoomBox',
    scrollSensitivity: (value): value is number => typeof value === 'number' && Number.isFinite(value),
    invertScroll: isBoolean,
    toolbarAutoHide: isBoolean,
    toolbarEnabled: isBoolean,
    minimapEnabled: isBoolean,
    toolbarPosition: (value): value is ToolbarPosition =>
        typeof value === 'string' && (TOOLBAR_POSITIONS as readonly string[]).includes(value),
    showDebugInfo: isBoolean,
    svgBackgroundColor: (value): value is string => typeof value === 'string',
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
    return Object.hasOwn(DEFAULT_SETTINGS, key);
}

/** Returns `value` if it is valid for `key`, otherwise the default for `key`. */
export function parseSetting<K extends SettingKey>(key: K, value: unknown): Settings[K] {
    return VALIDATORS[key](value) ? value : DEFAULT_SETTINGS[key];
}

/** Builds complete settings from raw storage contents, ignoring unknown keys. */
export function parseSettings(stored: Readonly<Record<string, unknown>>): Settings {
    const settings = { ...DEFAULT_SETTINGS };
    for (const key of SETTING_KEYS) {
        assignSetting(settings, key, stored[key]);
    }
    return settings;
}

function assignSetting<K extends SettingKey>(settings: Settings, key: K, value: unknown): void {
    settings[key] = parseSetting(key, value);
}

/** Reads every setting from sync storage. */
export async function loadSettings(): Promise<Settings> {
    return parseSettings(await chrome.storage.sync.get(null));
}

/** Persists a single setting to sync storage. */
export async function saveSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<void> {
    await chrome.storage.sync.set({ [key]: value });
}
