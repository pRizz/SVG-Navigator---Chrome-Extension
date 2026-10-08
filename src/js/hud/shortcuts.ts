/**
 * The `?` popover: the mouse and keyboard bindings that `svgNavigator.ts` listens for.
 * Keep these rows in step with the handlers there and the popup's Information tab.
 */

import type { ClickAndDragBehavior } from '../../shared/settings';

export type ShortcutRow = readonly [action: string, keys: string];

export function shortcutRows(clickAndDragBehavior: ClickAndDragBehavior, isMac: boolean): ShortcutRow[] {
    const dragRows: ShortcutRow[] = clickAndDragBehavior === 'pan'
        ? [['Pan', 'Drag, or hold Space and move']]
        : [['Zoom to an area', 'Drag'], ['Pan', 'Hold Space and move']];
    return [
        ['Zoom at the pointer', 'Scroll'],
        ...dragRows,
        ['Zoom in / out', 'Ctrl = / Ctrl −'],
        ['Zoom out', isMac ? 'Tap Option' : 'Tap Alt'],
        ['Reset view', 'Esc or Ctrl 0'],
    ];
}
