/**
 * The minimap's geometry (#48): its size, the current view's outline in it, and the
 * mapping between minimap pixels and drawing coordinates. Pure; `minimap.ts` draws.
 * `whole` is the original view, the whole drawing fitted to the window.
 */

import type { Point, ViewBox } from '../viewBox';

export interface Size {
    width: number;
    height: number;
}

export interface Rect extends Size {
    x: number;
    y: number;
}

const MAX_SIZE: Size = { width: 160, height: 120 };
// Rounding slack when the view sits exactly on the drawing's edges.
const EDGE_SLACK = 1e-9;

/** The minimap's size: the drawing's shape, as large as fits in 160 × 120. */
export function minimapSize(whole: ViewBox): Size {
    const scale = Math.min(MAX_SIZE.width / whole.width, MAX_SIZE.height / whole.height);
    return { width: whole.width * scale, height: whole.height * scale };
}

/** Whether the view takes in the whole drawing, so the minimap has nothing to add. */
export function showsWholeDrawing(view: ViewBox, whole: ViewBox): boolean {
    const slack = EDGE_SLACK * Math.max(whole.width, whole.height);
    return view.x <= whole.x + slack
        && view.y <= whole.y + slack
        && view.x + view.width >= whole.x + whole.width - slack
        && view.y + view.height >= whole.y + whole.height - slack;
}

/** The view's outline, in minimap pixels. */
export function outlineRect(view: ViewBox, whole: ViewBox, size: Size): Rect {
    const scale = size.width / whole.width;
    return {
        x: (view.x - whole.x) * scale,
        y: (view.y - whole.y) * scale,
        width: view.width * scale,
        height: view.height * scale,
    };
}

/** The drawing coordinates under a minimap pixel. */
export function drawingPointAt(pixel: Point, whole: ViewBox, size: Size): Point {
    const scale = whole.width / size.width;
    return { x: whole.x + pixel.x * scale, y: whole.y + pixel.y * scale };
}

/** `view` moved, keeping its size, so `center` is in the middle. */
export function viewCenteredOn(view: ViewBox, center: Point): ViewBox {
    return { ...view, x: center.x - view.width / 2, y: center.y - view.height / 2 };
}
