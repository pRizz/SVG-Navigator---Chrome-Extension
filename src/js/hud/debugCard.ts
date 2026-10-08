/**
 * The debug card: a read-only snapshot of the view, pointer, document, input,
 * environment, and build. Copy puts it on the clipboard for a bug report; minimize
 * folds it into a chip in the same corner.
 */

import { debugSections, debugText, type DebugInfo, type DebugSection } from './debugInfo';
import { button, iconButton } from './dom';
import { icon } from './icons';
import type { DebugCorner } from './layout';

const COPY_FEEDBACK_MS = 1_500;
const COPY_LABEL = 'Copy debug info';

export interface DebugCard {
    render: (info: DebugInfo) => void;
    setCorner: (corner: DebugCorner) => void;
    remove: () => void;
}

export function mountDebugCard(htmlDoc: Document, root: ShadowRoot, corner: DebugCorner): DebugCard {
    let maybeLatest: DebugInfo | null = null;
    let maybeFeedbackTimer: ReturnType<typeof setTimeout> | undefined;

    const card = htmlDoc.createElement('section');
    card.className = 'debug';
    card.setAttribute('aria-label', 'Debug info');
    const header = htmlDoc.createElement('div');
    header.className = 'debug-header';
    const title = htmlDoc.createElement('span');
    title.textContent = 'Debug';
    const copyButton = iconButton(htmlDoc, 'copy', { className: 'debug-copy', label: COPY_LABEL, title: COPY_LABEL, onClick: copy });
    const minimizeButton = iconButton(htmlDoc, 'minus', {
        className: 'debug-minimize',
        label: 'Minimize debug info',
        title: 'Minimize',
        onClick: () => setMinimized(true),
    });
    const body = htmlDoc.createElement('div');
    body.className = 'debug-body';
    const chip = button(htmlDoc, { className: 'debug-chip', label: 'Show debug info', title: 'Show debug info', onClick: () => setMinimized(false) });
    chip.textContent = 'Debug';
    chip.hidden = true;

    header.append(title, copyButton, minimizeButton);
    card.append(header, body);
    root.append(card, chip);

    function setCopyButton(iconName: 'copy' | 'check', label: string): void {
        copyButton.replaceChildren(icon(htmlDoc, iconName));
        copyButton.setAttribute('aria-label', label);
        copyButton.title = label;
    }

    function flashCopyResult(iconName: 'copy' | 'check', label: string): void {
        setCopyButton(iconName, label);
        clearTimeout(maybeFeedbackTimer);
        maybeFeedbackTimer = setTimeout(() => setCopyButton('copy', COPY_LABEL), COPY_FEEDBACK_MS);
    }

    function copy(): void {
        if (maybeLatest === null) { return; }
        const text = debugText(debugSections(maybeLatest));
        // Wrapped so a missing clipboard (an insecure page) rejects instead of throwing.
        Promise.resolve()
            .then(() => navigator.clipboard.writeText(text))
            .then(
                () => flashCopyResult('check', 'Copied'),
                (error: unknown) => {
                    console.warn('SVG Navigator: could not copy debug info', error);
                    flashCopyResult('copy', 'Couldn\'t copy');
                },
            );
    }

    function setMinimized(minimized: boolean): void {
        // Only a keyboard user, who still has focus on the card, needs it carried across.
        const hadFocus = root.activeElement === minimizeButton || root.activeElement === chip;
        card.hidden = minimized;
        chip.hidden = !minimized;
        if (!minimized && maybeLatest !== null) {
            renderBody(maybeLatest);
        }
        if (hadFocus) {
            (minimized ? chip : minimizeButton).focus();
        }
    }

    function renderBody(info: DebugInfo): void {
        body.replaceChildren(...debugSections(info).map((section) => sectionElement(htmlDoc, section)));
    }

    function setCorner(next: DebugCorner): void {
        card.dataset.corner = next;
        chip.dataset.corner = next;
    }
    setCorner(corner);

    return {
        render: (info) => {
            maybeLatest = info;
            if (!card.hidden) {
                renderBody(info);
            }
        },
        setCorner,
        remove: () => {
            clearTimeout(maybeFeedbackTimer);
            card.remove();
            chip.remove();
        },
    };
}

function sectionElement(htmlDoc: Document, { title, rows }: DebugSection): DocumentFragment {
    const heading = htmlDoc.createElement('h3');
    heading.textContent = title;
    const list = htmlDoc.createElement('dl');
    for (const [name, value] of rows) {
        const term = htmlDoc.createElement('dt');
        term.textContent = name;
        const detail = htmlDoc.createElement('dd');
        detail.textContent = value;
        list.append(term, detail);
    }
    const fragment = htmlDoc.createDocumentFragment();
    fragment.append(heading, list);
    return fragment;
}
