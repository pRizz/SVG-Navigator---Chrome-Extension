/**
 * The `?` popover: renders the shared shortcut list (`src/shared/shortcuts.ts`) as text.
 */

import { shortcutText, type ShortcutRow } from '../../shared/shortcuts';

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
    for (const row of rows) {
        const term = htmlDoc.createElement('dt');
        term.textContent = row.action;
        const detail = htmlDoc.createElement('dd');
        detail.textContent = shortcutText(row);
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
