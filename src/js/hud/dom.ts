/** Button builders for the HUD. `htmlDoc` makes real HTML elements even in an XML page. */

import { icon, type IconName } from './icons';

export interface ButtonSpec {
    className: string;
    /** The accessible name. */
    label: string;
    /** The hover tooltip; include the keyboard shortcut when there is one. */
    title: string;
    onClick: () => void;
}

export function button(htmlDoc: Document, { className, label, title, onClick }: ButtonSpec): HTMLButtonElement {
    const element = htmlDoc.createElement('button');
    element.type = 'button';
    element.className = className;
    element.setAttribute('aria-label', label);
    element.title = title;
    element.addEventListener('click', (event) => {
        // A mouse click would leave the button focused, and the next Space would then press it
        // again instead of starting a spacebar pan. Keyboard activation (detail 0) keeps focus.
        if (event.detail > 0) {
            element.blur();
        }
        onClick();
    });
    return element;
}

export function iconButton(htmlDoc: Document, iconName: IconName, spec: ButtonSpec): HTMLButtonElement {
    const element = button(htmlDoc, spec);
    element.append(icon(htmlDoc, iconName));
    return element;
}
