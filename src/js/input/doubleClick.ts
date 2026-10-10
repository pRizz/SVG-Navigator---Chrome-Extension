/**
 * When a double-click on the drawing zooms. Pure; `pointer.ts` tracks the presses and
 * runs the zoom. Browsers can report a double-click after two quick drags, so one that
 * follows a drag is ignored: a pan or zoom box must never zoom as well.
 */

import type { Point } from '../viewBox';

/** Movement (CSS pixels) between press and release beyond which a click is a drag. */
const DRAG_THRESHOLD_PX = 4;
/** About the longest double-click interval systems allow, so any click of it could be the drag. */
const DOUBLE_CLICK_WINDOW_MS = 500;

/** Whether the pointer moved far enough between press and release to count as a drag. */
export function isDrag(press: Point, release: Point): boolean {
    return Math.hypot(release.x - press.x, release.y - press.y) > DRAG_THRESHOLD_PX;
}

/** Whether a double-click at `nowMs` zooms, given when the last drag ended (if ever). */
export function shouldZoomOnDoubleClick(nowMs: number, maybeLastDragEndMs: number | null): boolean {
    return maybeLastDragEndMs === null || nowMs - maybeLastDragEndMs > DOUBLE_CLICK_WINDOW_MS;
}

/** The viewBox scale for a double-click: below 1 zooms in, Shift zooms out. */
export function doubleClickZoomFactor(shiftKey: boolean): number {
    return shiftKey ? 2 : 0.5;
}
