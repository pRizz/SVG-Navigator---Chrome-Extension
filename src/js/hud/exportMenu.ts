/**
 * The Export menu (#51): a popover of buttons for a link to the view, PNGs of the view,
 * and the SVG as authored, plus the way back to the original SVG. Builds DOM only;
 * `hud.ts` opens and closes it, and `src/js/export/exporter.ts` does the work.
 */

import { PNG_SCALES, type PngScale, type Size } from '../export/exportPlan';
import { button } from './dom';

export interface ExportActions {
    /** Each action resolves to the status line to show, failures included. */
    copyLink: () => Promise<string>;
    pngSize: (scale: PngScale) => Size;
    savePng: (scale: PngScale) => Promise<string>;
    downloadSvg: () => Promise<string>;
    copySource: () => Promise<string>;
    /** Null where the site blocks the storage the per-tab off switch needs. */
    maybeShowOriginal: (() => void) | null;
}

export interface ExportMenu {
    element: HTMLDivElement;
    isOpen: () => boolean;
    setOpen: (open: boolean) => void;
    /** Moves keyboard focus into the menu. */
    focusFirstItem: () => void;
}

export function createExportMenu(htmlDoc: Document, actions: ExportActions): ExportMenu {
    const element = htmlDoc.createElement('div');
    element.className = 'popover export-menu';
    element.id = 'export';
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-label', 'Export');
    element.hidden = true;

    const status = htmlDoc.createElement('p');
    status.className = 'export-status';
    status.setAttribute('role', 'status');
    // Only the latest action's outcome shows, whichever finishes first.
    let latestRun = 0;

    function run(action: () => Promise<string>, pendingText = ''): void {
        const thisRun = ++latestRun;
        status.textContent = pendingText;
        void action().then((text) => {
            if (thisRun === latestRun) { status.textContent = text; }
        });
    }

    const item = (className: string, text: string, onClick: () => void, title = text): HTMLButtonElement => {
        const itemButton = button(htmlDoc, { className: `menu-item ${className}`, label: text, title, onClick });
        itemButton.textContent = text;
        return itemButton;
    };

    const heading = htmlDoc.createElement('h2');
    heading.textContent = 'Export';
    const copyLink = item('export-copy-link', 'Copy link to this view', () => run(actions.copyLink));

    const pngLabel = htmlDoc.createElement('p');
    pngLabel.className = 'menu-label';
    pngLabel.id = 'export-png-label';
    pngLabel.textContent = 'PNG of this view';
    const pngScales = htmlDoc.createElement('div');
    pngScales.className = 'png-scales';
    pngScales.setAttribute('role', 'group');
    pngScales.setAttribute('aria-labelledby', pngLabel.id);
    const pngButtons = PNG_SCALES.map((scale) => {
        const scaleButton = button(htmlDoc, {
            className: 'export-png',
            label: `${scale}×`,
            title: `Save a PNG at ${scale}× the view's size on screen`,
            onClick: () => run(() => actions.savePng(scale), 'Saving…'),
        });
        scaleButton.dataset.scale = String(scale);
        pngScales.append(scaleButton);
        return { scale, scaleButton };
    });

    const separator = htmlDoc.createElement('hr');
    separator.className = 'menu-separator';
    const maybeShowOriginal = actions.maybeShowOriginal;

    element.append(
        heading,
        copyLink,
        pngLabel,
        pngScales,
        item('export-svg', 'Download SVG', () => run(actions.downloadSvg), 'Download the SVG as authored'),
        item('export-copy-source', 'Copy SVG source', () => run(actions.copySource)),
        ...(maybeShowOriginal ? [
            separator,
            item('export-show-original', 'Show the original SVG', maybeShowOriginal, 'Turn SVG Navigator off in this tab; turn it back on from the toolbar button'),
        ] : []),
        status,
    );

    // The sizes follow the window, so they're worked out each time the menu opens.
    function renderPngSizes(): void {
        for (const { scale, scaleButton } of pngButtons) {
            const { width, height } = actions.pngSize(scale);
            const scaleText = htmlDoc.createElement('span');
            scaleText.className = 'png-scale';
            scaleText.textContent = `${scale}×`;
            const sizeText = htmlDoc.createElement('span');
            sizeText.className = 'png-size';
            sizeText.textContent = `${width} × ${height}`;
            scaleButton.replaceChildren(scaleText, sizeText);
            scaleButton.setAttribute('aria-label', `${scale}×, ${width} by ${height} pixels`);
        }
    }

    return {
        element,
        isOpen: () => !element.hidden,
        setOpen: (open) => {
            if (open) {
                renderPngSizes();
                latestRun++;
                status.textContent = '';
            }
            element.hidden = !open;
        },
        focusFirstItem: () => copyLink.focus(),
    };
}
