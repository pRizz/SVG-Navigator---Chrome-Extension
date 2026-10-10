/**
 * Smooth view changes (#46): a discrete step (a button, a key, a double-click) eases
 * from the current view to its target instead of jumping. Zooms scale geometrically
 * about their fixed point, so the point under the cursor stays put the whole way.
 * The animator takes its clock and frame scheduler as dependencies, for testing.
 */

import type { ViewBox } from './viewBox';

// Relative size change below which two views differ only by a pan.
const SAME_SIZE = 1e-12;

/** The view a fraction `t` (0 to 1) of the way from `from` to `to`. */
export function interpolateViewBox(from: ViewBox, to: ViewBox, t: number): ViewBox {
    if (t <= 0) { return from; }
    if (t >= 1) { return to; }
    const [x, width] = interpolateAxis(from.x, from.width, to.x, to.width, t);
    const [y, height] = interpolateAxis(from.y, from.height, to.y, to.height, t);
    return { x, y, width, height };
}

// One axis: geometric scaling about the fixed point `c` (where `end - c = scale ×
// (start - c)`), or a straight line for a pure pan, which has no fixed point.
function interpolateAxis(start: number, startSize: number, end: number, endSize: number, t: number): [position: number, size: number] {
    const scale = endSize / startSize;
    if (Math.abs(scale - 1) < SAME_SIZE) {
        return [start + (end - start) * t, startSize + (endSize - startSize) * t];
    }
    const stepScale = scale ** t;
    const fixedPoint = (end - scale * start) / (1 - scale);
    return [fixedPoint + stepScale * (start - fixedPoint), startSize * stepScale];
}

/** Fast at first, settling gently onto the target. */
export function easeOutCubic(t: number): number {
    return 1 - (1 - t) ** 3;
}

export interface FrameScheduler {
    now: () => number;
    request: (callback: (time: number) => void) => number;
    cancel: (handle: number) => void;
}

export interface ViewAnimatorDeps {
    frames: FrameScheduler;
    /** The default duration, for discrete steps. */
    durationMs: number;
    /** The view on screen now, where an animation starts. */
    current: () => ViewBox;
    show: (view: ViewBox) => void;
    onAnimatingChange?: (animating: boolean) => void;
}

export interface ViewAnimator {
    /**
     * Eases to `target` from the current view, over `durationMs` if given; a new
     * target replaces one in flight.
     */
    animateTo: (target: ViewBox, durationMs?: number) => void;
    /** Where the running animation ends, so the next step can build on it; null when idle. */
    maybeTarget: () => ViewBox | null;
    /** Stops where the view is, e.g. when a drag or the wheel takes over. */
    cancel: () => void;
}

interface Run {
    from: ViewBox;
    to: ViewBox;
    startMs: number;
    durationMs: number;
    handle: number;
}

export function createViewAnimator(deps: ViewAnimatorDeps): ViewAnimator {
    let maybeRun: Run | null = null;

    function setRun(next: Run | null): void {
        const wasAnimating = maybeRun !== null;
        maybeRun = next;
        if (wasAnimating !== (next !== null)) {
            deps.onAnimatingChange?.(next !== null);
        }
    }

    function frame(time: number): void {
        if (maybeRun === null) { return; }
        const t = Math.min(1, (time - maybeRun.startMs) / maybeRun.durationMs);
        deps.show(interpolateViewBox(maybeRun.from, maybeRun.to, easeOutCubic(t)));
        if (t >= 1) {
            setRun(null);
            return;
        }
        maybeRun.handle = deps.frames.request(frame);
    }

    function cancel(): void {
        if (maybeRun === null) { return; }
        deps.frames.cancel(maybeRun.handle);
        setRun(null);
    }

    return {
        animateTo: (target, durationMs = deps.durationMs) => {
            if (maybeRun !== null) { deps.frames.cancel(maybeRun.handle); }
            const startMs = deps.frames.now();
            const handle = deps.frames.request(frame);
            setRun({ from: deps.current(), to: target, startMs, durationMs, handle });
        },
        maybeTarget: () => maybeRun?.to ?? null,
        cancel,
    };
}
