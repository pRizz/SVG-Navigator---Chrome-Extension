/**
 * The navigator's keyboard bindings as data: which key event triggers which action.
 * Pure; `svgNavigator.ts` listens for `keydown` and `keyup` and runs the action.
 * Keep the shortcut list in `src/shared/shortcuts.ts` in step with this table.
 */

export type KeyAction =
    | { kind: 'zoomIn' }
    | { kind: 'zoomOut' }
    | { kind: 'reset' }
    | { kind: 'panStart' }
    | { kind: 'panEnd' }
    /** Moves the view by `dx` and `dy`, as fractions of its width and height. */
    | { kind: 'nudge', dx: number, dy: number }
    | { kind: 'toggleFullscreen' }
    | { kind: 'toggleShortcuts' };

/** The parts of a `KeyboardEvent` the bindings look at. */
export interface KeyEventLike {
    type: 'keydown' | 'keyup';
    /** The character or named key, e.g. `'Escape'`, `'Alt'`, `'?'`. */
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
    action: (event: KeyEventLike) => KeyAction;
}

const NUDGE = 0.1;
const LARGE_NUDGE = 0.5;

const ARROWS: Readonly<Record<string, readonly [dx: number, dy: number]>> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
};

const always = (action: KeyAction) => (): KeyAction => action;

// Zoom keys match the physical key (`code`): Firefox and Chrome report different
// keyCodes for `=` and `-`, and Shift turns `=` into `+`. Ctrl and ⌘ are allowed so the
// browser's own zoom shortcuts zoom the drawing instead; Alt types characters on macOS.
const zoomKey = (...codes: string[]) => (event: KeyEventLike): boolean =>
    codes.includes(event.code) && !event.altKey;

// Plain keys only: ⌘/Ctrl + arrow is back/forward and ⌘ F is Find in the browser.
const noCommandKeys = ({ ctrlKey, metaKey, altKey }: KeyEventLike): boolean => !ctrlKey && !metaKey && !altKey;

const isSpace = ({ key, code }: KeyEventLike): boolean => code === 'Space' || key === ' ';

const KEY_BINDINGS: readonly KeyBinding[] = [
    { type: 'keydown', matches: zoomKey('Equal', 'NumpadAdd'), action: always({ kind: 'zoomIn' }) },
    { type: 'keydown', matches: zoomKey('Minus', 'NumpadSubtract'), action: always({ kind: 'zoomOut' }) },
    { type: 'keydown', matches: zoomKey('Digit0', 'Numpad0'), action: always({ kind: 'reset' }) },
    {
        type: 'keydown',
        matches: (event) => event.key in ARROWS && noCommandKeys(event),
        action: ({ key, shiftKey }) => {
            const [dx, dy] = ARROWS[key] ?? [0, 0];
            const step = shiftKey ? LARGE_NUDGE : NUDGE;
            return { kind: 'nudge', dx: dx * step, dy: dy * step };
        },
    },
    { type: 'keydown', matches: (event) => event.code === 'KeyF' && noCommandKeys(event) && !event.shiftKey, action: always({ kind: 'toggleFullscreen' }) },
    { type: 'keydown', matches: (event) => event.key === '?' && noCommandKeys(event), action: always({ kind: 'toggleShortcuts' }) },
    { type: 'keydown', matches: isSpace, action: always({ kind: 'panStart' }) },
    { type: 'keyup', matches: isSpace, action: always({ kind: 'panEnd' }) },
    { type: 'keyup', matches: ({ key }) => key === 'Escape', action: always({ kind: 'reset' }) },
    { type: 'keyup', matches: ({ key }) => key === 'Alt', action: always({ kind: 'zoomOut' }) },
];

/** The action `event` triggers, or null when it isn't bound. */
export function keyAction(event: KeyEventLike): KeyAction | null {
    const maybeBinding = KEY_BINDINGS.find((binding) => binding.type === event.type && binding.matches(event));
    return maybeBinding ? maybeBinding.action(event) : null;
}
