/**
 * The floating +, -, and Reset toolbar shown over a navigated SVG.
 */

export interface ToolbarActions {
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
}

const AUTO_HIDE_DELAY_MS = 5_000;

/**
 * Adds the toolbar to `parent`; with `autoHide`, it fades out after a few seconds.
 * `htmlDoc` creates the elements: in a standalone SVG page, `document` is an XML
 * document whose `createElement` makes plain (unstyled) elements, not HTML ones.
 */
export function addToolbar(
    htmlDoc: Document,
    parent: HTMLElement,
    actions: ToolbarActions,
    { autoHide }: { autoHide: boolean },
): void {
    const toolbarContainer = htmlDoc.createElement('div');
    toolbarContainer.className = 'toolbarcontainer';

    const toolbarDiv = htmlDoc.createElement('div');
    toolbarDiv.className = 'toolbar';
    toolbarContainer.appendChild(toolbarDiv);

    const buttons: [label: string, className: string, onClick: () => void][] = [
        ['+', 'toolbarbutton toolbarbuttonborder', actions.zoomIn],
        ['-', 'toolbarbutton toolbarbuttonborder', actions.zoomOut],
        ['Reset', 'toolbarbutton', actions.reset],
    ];
    for (const [label, className, onClick] of buttons) {
        const button = htmlDoc.createElement('div');
        button.textContent = label;
        button.className = className;
        button.onclick = onClick;
        toolbarDiv.appendChild(button);
    }

    parent.appendChild(toolbarContainer);

    // Clearing the inline opacity hands control back to the stylesheet, which hides
    // the toolbar until it is hovered.
    toolbarContainer.style.opacity = '1';
    if (autoHide) {
        setTimeout(() => {
            toolbarContainer.style.opacity = '';
        }, AUTO_HIDE_DELAY_MS);
    }
}
