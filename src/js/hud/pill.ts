/** The pill of HUD buttons. Builds DOM only; `hud.ts` wires placement and behavior. */

import { button, iconButton } from './dom';

export interface PillActions {
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
}

export interface Pill {
    element: HTMLDivElement;
    setZoomLabel: (text: string) => void;
}

export function createPill(htmlDoc: Document, actions: PillActions): Pill {
    const element = htmlDoc.createElement('div');
    element.className = 'pill';
    element.setAttribute('role', 'toolbar');
    element.setAttribute('aria-label', 'SVG Navigator');

    const zoomLabelButton = button(htmlDoc, {
        className: 'zoom-label',
        label: 'Reset zoom',
        title: 'Reset to 100% (Esc)',
        onClick: actions.reset,
    });
    element.append(
        iconButton(htmlDoc, 'minus', { className: 'zoom-out', label: 'Zoom out', title: 'Zoom out (Ctrl −)', onClick: actions.zoomOut }),
        zoomLabelButton,
        iconButton(htmlDoc, 'plus', { className: 'zoom-in', label: 'Zoom in', title: 'Zoom in (Ctrl =)', onClick: actions.zoomIn }),
    );

    const setZoomLabel = (text: string): void => {
        zoomLabelButton.textContent = text;
        zoomLabelButton.setAttribute('aria-label', `Zoom ${text}, reset to 100%`);
    };
    setZoomLabel('100%');
    return { element, setZoomLabel };
}
