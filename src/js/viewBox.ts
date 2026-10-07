/**
 * Pure viewBox geometry for the navigator: parsing, formatting, fitting to the
 * window's aspect ratio, and zooming. Nothing here touches the DOM.
 */

export interface ViewBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Point {
    x: number;
    y: number;
}

/** `-deltaY * 10` at or beyond this magnitude counts as one full-strength wheel step. */
const MAX_WHEEL_DELTA = 1200;

/**
 * Parses an SVG `viewBox` attribute, whose four numbers may be separated by
 * whitespace and/or a comma. Returns `null` for anything a browser would not render
 * with: the wrong count, a non-number, or a width or height that is not positive.
 */
export function maybeParseViewBox(text: string): ViewBox | null {
    const [x = NaN, y = NaN, width = NaN, height = NaN, ...extra] = text.trim().split(/[\s,]+/).map(parseFloat);
    const isUsable = extra.length === 0 && [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0;
    return isUsable ? { x, y, width, height } : null;
}

/** The axis-aligned rectangle spanned by two opposite corners. */
export function rectFromCorners(a: Point, b: Point): ViewBox {
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y),
    };
}

/**
 * Moves `viewBox` so the user-space point `anchor`, grabbed when the pan began,
 * lies under the cursor again; `cursor` is where the cursor points in user space now.
 */
export function panViewBox(viewBox: ViewBox, anchor: Point, cursor: Point): ViewBox {
    return { ...viewBox, x: viewBox.x - (cursor.x - anchor.x), y: viewBox.y - (cursor.y - anchor.y) };
}

export function formatViewBox({ x, y, width, height }: ViewBox): string {
    return `${x} ${y} ${width} ${height}`;
}

/**
 * Grows the narrower dimension of `viewBox` until it matches `aspectRatio`
 * (width / height), keeping the box centered on the same point.
 */
export function fitToAspectRatio(viewBox: ViewBox, aspectRatio: number): ViewBox {
    if (viewBox.width / viewBox.height < aspectRatio) {
        const width = viewBox.height * aspectRatio;
        return { ...viewBox, x: viewBox.x - (width - viewBox.width) / 2, width };
    }
    const height = viewBox.width / aspectRatio;
    return { ...viewBox, y: viewBox.y - (height - viewBox.height) / 2, height };
}

/**
 * Scales `viewBox` by `factor` (below 1 zooms in) while keeping `point` at the same
 * place on screen, like zooming a map under the cursor.
 */
export function zoomAroundPoint(viewBox: ViewBox, point: Point, factor: number): ViewBox {
    const width = viewBox.width * factor;
    const height = viewBox.height * factor;
    return {
        x: point.x - ((point.x - viewBox.x) / viewBox.width) * width,
        y: point.y - ((point.y - viewBox.y) / viewBox.height) * height,
        width,
        height,
    };
}

/** Scales `viewBox` by `factor` (below 1 zooms in) around its center. */
export function zoomAroundCenter(viewBox: ViewBox, factor: number): ViewBox {
    const center = { x: viewBox.x + viewBox.width / 2, y: viewBox.y + viewBox.height / 2 };
    return zoomAroundPoint(viewBox, center, factor);
}

/**
 * Converts a wheel event's `deltaY` into a viewBox scale factor: below 1 zooms in
 * (scrolling up, unless `invert`), above 1 zooms out. `sensitivity` is relative to
 * `maxSensitivity`, and deltas beyond one full wheel step are clamped.
 */
export function wheelZoomFactor(
    deltaY: number,
    { sensitivity, maxSensitivity, invert }: { sensitivity: number, maxSensitivity: number, invert: boolean },
): number {
    const wheelDelta = Math.min(1, Math.max(-1, (-deltaY * 10) / MAX_WHEEL_DELTA));
    const scrollAmount = (wheelDelta * sensitivity * (invert ? -1 : 1)) / maxSensitivity;
    return scrollAmount < 0 ? 1 + (-scrollAmount + 0.01) : 1 / (1 + (scrollAmount + 0.01));
}
