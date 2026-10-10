/**
 * The navigator's keyboard bindings as data: which key event triggers which action.
 * Pure; `svgNavigator.ts` listens for `keydown` and `keyup` and runs the action.
 * Keep the shortcut list in `src/shared/shortcuts.ts` in step with this table.
 */

export type KeyAction = 'zoomIn' | 'zoomOut' | 'reset' | 'panStart' | 'panEnd';

/** The parts of a `KeyboardEvent` the bindings look at. */
export interface KeyEventLike {
    type: 'keydown' | 'keyup';
    /** The character or named key, e.g. `'Escape'`, `'Alt'`, `' '`. */
    key: string;
    /** The physical key, e.g. `'Equal'`, which is the same on every browser and layout. */
    code: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
}

interface KeyBinding {
    type: KeyEventLike['type'];
    matches: (event: KeyEventLike) => boolean;
    action: KeyAction;
}

const isSpace = ({ key, code }: KeyEventLike): boolean => code === 'Space' || key === ' ';

// Zoom keys match the physical key (`code`), not the character or `keyCode`: Firefox
// and Chrome report different keyCodes for `=` and `-`, and Shift turns `=` into `+`.
const withCtrl = (code: string) => (event: KeyEventLike): boolean => event.ctrlKey && event.code === code;

const KEY_BINDINGS: readonly KeyBinding[] = [
    { type: 'keydown', matches: isSpace, action: 'panStart' },
    { type: 'keyup', matches: isSpace, action: 'panEnd' },
    { type: 'keyup', matches: ({ key }) => key === 'Escape', action: 'reset' },
    { type: 'keyup', matches: ({ key }) => key === 'Alt', action: 'zoomOut' },
    { type: 'keyup', matches: withCtrl('Equal'), action: 'zoomIn' },
    { type: 'keyup', matches: withCtrl('Minus'), action: 'zoomOut' },
    { type: 'keyup', matches: withCtrl('Digit0'), action: 'reset' },
];

/** The action `event` triggers, or null when it isn't bound. */
export function keyAction(event: KeyEventLike): KeyAction | null {
    return KEY_BINDINGS.find((binding) => binding.type === event.type && binding.matches(event))?.action ?? null;
}
