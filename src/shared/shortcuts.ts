/**
 * The navigator's mouse and keyboard shortcuts, as shown to people: the HUD's `?`
 * popover and the popup's Controls card both render this one list. Keep it in step
 * with the bindings in `src/js/input/keyActions.ts` and the pointer handlers in
 * `src/js/svgNavigator.ts`.
 */

import type { ClickAndDragBehavior } from './settings';

/** Plain connecting text, or a key or gesture shown as a key cap. */
export type ShortcutPart = string | { key: string };

export interface ShortcutRow {
    action: string;
    parts: readonly ShortcutPart[];
}

/** The drag behavior to describe; the popup, which can't know the page, shows `either`. */
export type DragContext = ClickAndDragBehavior | 'either';

const key = (name: string): ShortcutPart => ({ key: name });

const DRAG_ROWS: Readonly<Record<DragContext, readonly ShortcutRow[]>> = {
    pan: [
        { action: 'Pan', parts: [key('Drag'), ', or hold ', key('Space'), ' and move'] },
    ],
    zoomBox: [
        { action: 'Zoom to an area', parts: [key('Drag')] },
        { action: 'Pan', parts: ['Hold ', key('Space'), ' and move'] },
    ],
    either: [
        { action: 'Pan', parts: [key('Drag'), ' (pan mode), or hold ', key('Space'), ' and move'] },
        { action: 'Zoom to an area', parts: [key('Drag'), ' (zoom box mode)'] },
    ],
};

export function shortcutRows(drag: DragContext, isMac: boolean): ShortcutRow[] {
    return [
        { action: 'Zoom at the pointer', parts: [key('Scroll')] },
        ...DRAG_ROWS[drag],
        { action: 'Zoom in / out', parts: [key('Ctrl'), ' ', key('='), ' / ', key('Ctrl'), ' ', key('−')] },
        { action: 'Zoom out', parts: ['Tap ', key(isMac ? 'Option' : 'Alt')] },
        { action: 'Reset view', parts: [key('Esc'), ' or ', key('Ctrl'), ' ', key('0')] },
    ];
}

/** A row's keys as plain text, e.g. `Esc or Ctrl 0`. */
export function shortcutText({ parts }: ShortcutRow): string {
    return parts.map((part) => (typeof part === 'string' ? part : part.key)).join('');
}
