/**
 * Selectable text (#32): with the setting on, a drag or double-click that starts on the
 * drawing's text selects it, as on an ordinary page, instead of panning or zooming.
 * `pointer.ts` leaves such presses alone; `svgNavigator.ts` lets the selection start
 * and marks the page root so the text shows a text cursor.
 */

/** On the page root while text is selectable. */
export const SELECTABLE_TEXT_ATTRIBUTE = 'data-svg-navigator-selectable-text';

export const SELECTABLE_TEXT_CSS = `:root[${SELECTABLE_TEXT_ATTRIBUTE}] svg text { cursor: text; }`;

/** Whether an event's target is the drawing's text: a `<text>`, its `<tspan>`s, or their characters. */
export function isOnText(maybeTarget: EventTarget | null): boolean {
    const maybeElement = maybeTarget instanceof Element ? maybeTarget
        : maybeTarget instanceof Node ? maybeTarget.parentElement
            : null;
    return (maybeElement?.closest('text') ?? null) !== null;
}
