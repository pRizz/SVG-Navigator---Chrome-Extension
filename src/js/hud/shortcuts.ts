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

export interface ShortcutsPopover {
    element: HTMLDivElement;
    isOpen: () => boolean;
    setOpen: (open: boolean) => void;
}

export function createShortcutsPopover(htmlDoc: Document, rows: readonly ShortcutRow[]): ShortcutsPopover {
    const element = htmlDoc.createElement('div');
    element.className = 'popover';
    element.id = 'shortcuts';
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-label', 'Shortcuts');
    element.hidden = true;

    const heading = htmlDoc.createElement('h2');
    heading.textContent = 'Shortcuts';
    const list = htmlDoc.createElement('dl');
    for (const [action, keys] of rows) {
        const term = htmlDoc.createElement('dt');
        term.textContent = action;
        const detail = htmlDoc.createElement('dd');
        detail.textContent = keys;
        list.append(term, detail);
    }
    element.append(heading, list);

    return {
        element,
        isOpen: () => !element.hidden,
        setOpen: (open) => {
            element.hidden = !open;
        },
    };
}
