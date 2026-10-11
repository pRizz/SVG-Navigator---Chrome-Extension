/** The pill of HUD buttons. Builds DOM only; `hud.ts` wires placement and behavior. */

import { button, iconButton } from './dom';
import { icon } from './icons';

export interface PillActions {
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    cycleBackground: () => void;
    toggleFullscreen: () => void;
    toggleExport: () => void;
    toggleShortcuts: () => void;
}

export interface Pill {
    element: HTMLDivElement;
    setZoomLabel: (text: string) => void;
    setBackgroundTitle: (title: string) => void;
    setFullscreen: (isFullscreen: boolean) => void;
    setShortcutsExpanded: (expanded: boolean) => void;
    setExportExpanded: (expanded: boolean) => void;
    /** The export button, which keeps focus while a keyboard opens the menu. */
    exportButton: HTMLButtonElement;
}

export function createPill(htmlDoc: Document, actions: PillActions, { fullscreenEnabled }: { fullscreenEnabled: boolean }): Pill {
    const element = htmlDoc.createElement('div');
    element.className = 'pill';
    element.setAttribute('role', 'toolbar');
    element.setAttribute('aria-label', 'SVG Navigator');

    const zoomLabelButton = button(htmlDoc, {
        className: 'zoom-label',
        label: 'Reset zoom',
        title: 'Reset to 100% (Esc or 0)',
        onClick: actions.reset,
    });
    const separator = htmlDoc.createElement('span');
    separator.className = 'separator';
    separator.setAttribute('aria-hidden', 'true');
    const background = iconButton(htmlDoc, 'background', {
        className: 'utility background',
        label: 'Change background',
        title: 'Change background',
        onClick: actions.cycleBackground,
    });
    const fullscreen = iconButton(htmlDoc, 'maximize', {
        className: 'utility fullscreen',
        label: 'Enter full screen',
        title: 'Enter full screen (F)',
        onClick: actions.toggleFullscreen,
    });
    const exportButton = iconButton(htmlDoc, 'download', {
        className: 'utility export',
        label: 'Export',
        title: 'Export: PNG, SVG, or a link to this view',
        onClick: actions.toggleExport,
    });
    exportButton.setAttribute('aria-haspopup', 'dialog');
    exportButton.setAttribute('aria-controls', 'export');
    exportButton.setAttribute('aria-expanded', 'false');
    const shortcuts = iconButton(htmlDoc, 'help', {
        className: 'utility shortcuts',
        label: 'Shortcuts',
        title: 'Keyboard and mouse shortcuts (?)',
        onClick: actions.toggleShortcuts,
    });
    shortcuts.setAttribute('aria-haspopup', 'dialog');
    shortcuts.setAttribute('aria-controls', 'shortcuts');
    shortcuts.setAttribute('aria-expanded', 'false');

    element.append(
        iconButton(htmlDoc, 'minus', { className: 'zoom-out', label: 'Zoom out', title: 'Zoom out (−)', onClick: actions.zoomOut }),
        zoomLabelButton,
        iconButton(htmlDoc, 'plus', { className: 'zoom-in', label: 'Zoom in', title: 'Zoom in (+)', onClick: actions.zoomIn }),
        separator,
        background,
        // Inside an iframe that disallows it, full screen can't work, so don't offer it.
        ...(fullscreenEnabled ? [fullscreen] : []),
        exportButton,
        shortcuts,
    );

    const setZoomLabel = (text: string): void => {
        zoomLabelButton.textContent = text;
        zoomLabelButton.setAttribute('aria-label', `Zoom ${text}, reset to 100%`);
    };
    setZoomLabel('100%');

    return {
        element,
        setZoomLabel,
        setBackgroundTitle: (title) => {
            background.title = title;
        },
        setFullscreen: (isFullscreen) => {
            const label = isFullscreen ? 'Exit full screen' : 'Enter full screen';
            fullscreen.replaceChildren(icon(htmlDoc, isFullscreen ? 'minimize' : 'maximize'));
            fullscreen.setAttribute('aria-label', label);
            fullscreen.title = `${label} (F)`;
        },
        setShortcutsExpanded: (expanded) => {
            shortcuts.setAttribute('aria-expanded', String(expanded));
        },
        setExportExpanded: (expanded) => {
            exportButton.setAttribute('aria-expanded', String(expanded));
        },
        exportButton,
    };
}
