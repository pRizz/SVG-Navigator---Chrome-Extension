/**
 * How much one wheel event scales the view. Pure; `pointer.ts` applies it around the
 * pointer. Zoom is exponential in the distance scrolled, so a trackpad's many small
 * events add up to the same zoom as one mouse-wheel notch of the same total distance
 * (#47), and deltas are normalized to pixels whatever unit the browser reports.
 */

export interface WheelInput {
    deltaY: number;
    /** `WheelEvent.deltaMode`: 0 pixels, 1 lines, 2 pages. */
    deltaMode: number;
    /** Trackpad pinches arrive as wheel events with Ctrl set. */
    ctrlKey: boolean;
}

export interface WheelZoomSettings {
    sensitivity: number;
    maxSensitivity: number;
    invert: boolean;
    /** The window height, for page-mode deltas. */
    pageHeight: number;
}

const DELTA_LINE = 1;
const DELTA_PAGE = 2;
// Firefox reports mouse wheels in lines, about 3 a notch: 120 px, near Chrome's 100.
const LINE_PIXELS = 40;
// Per pixel at full sensitivity, calibrated so a 100 px notch at the default sensitivity
// (7 of 10) zooms in 1.59×, as the earlier per-event formula did.
const SCROLL_ZOOM_RATE = 0.00665;
// A pinch's deltaY is roughly 100 per e-fold of scale, so this rate keeps the drawing
// under the fingers. Sensitivity and invert don't apply: a pinch is a direct gesture.
const PINCH_ZOOM_RATE = 0.01;
// No single event zooms more than 2×, as before, so one huge delta can't jump.
const MAX_STEP = Math.LN2;

/** The event's delta in CSS pixels. */
export function wheelPixels({ deltaY, deltaMode }: Pick<WheelInput, 'deltaY' | 'deltaMode'>, pageHeight: number): number {
    switch (deltaMode) {
    case DELTA_LINE:
        return deltaY * LINE_PIXELS;
    case DELTA_PAGE:
        return deltaY * pageHeight;
    default:
        return deltaY;
    }
}

/** The viewBox scale for one wheel event: below 1 zooms in (scrolling up, unless inverted). */
export function wheelZoomFactor(input: WheelInput, { sensitivity, maxSensitivity, invert, pageHeight }: WheelZoomSettings): number {
    const pixels = wheelPixels(input, pageHeight);
    const exponent = input.ctrlKey
        ? pixels * PINCH_ZOOM_RATE
        : pixels * SCROLL_ZOOM_RATE * (sensitivity / maxSensitivity) * (invert ? -1 : 1);
    return Math.exp(Math.min(MAX_STEP, Math.max(-MAX_STEP, exponent)));
}
