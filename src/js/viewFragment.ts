/**
 * Shareable view links: the current view kept in the URL fragment with the standard
 * SVG view syntax, `#svgView(viewBox(x,y,w,h))`, which a browser without the extension
 * also opens at that view. Pure; `svgNavigator.ts` reads and writes `location`.
 */

import { maybeParseViewBox, type ViewBox } from './viewBox';

const SVG_VIEW = /^#svgView\((.*)\)$/s;
const VIEW_BOX_PARAMETER = /(?:^|;)\s*viewBox\(([^)]*)\)/;
/** Digits kept below the view's size: rounding error stays under 1/10,000 of the view. */
const EXTRA_DIGITS = 4;
const MAX_FRACTION_DIGITS = 100;

/** The view an `svgView(viewBox(...))` fragment names, or null for any other fragment. */
export function maybeParseSvgViewFragment(hash: string): ViewBox | null {
    const maybeDecoded = maybeDecode(hash);
    const maybeParameters = maybeDecoded === null ? undefined : SVG_VIEW.exec(maybeDecoded)?.[1];
    const maybeViewBox = maybeParameters === undefined ? undefined : VIEW_BOX_PARAMETER.exec(maybeParameters)?.[1];
    return maybeViewBox === undefined ? null : maybeParseViewBox(maybeViewBox);
}

/**
 * The fragment for `view`. Numbers are rounded relative to the view's size, so links
 * stay short at 100% yet still reopen a view zoomed in millions of times.
 */
export function formatSvgViewFragment(view: ViewBox): string {
    const fractionDigits = Math.min(
        MAX_FRACTION_DIGITS,
        Math.max(0, Math.ceil(-Math.log10(Math.min(view.width, view.height))) + EXTRA_DIGITS),
    );
    const numbers = [view.x, view.y, view.width, view.height].map((value) => String(Number(value.toFixed(fractionDigits))));
    return `#svgView(viewBox(${numbers.join(',')}))`;
}

/**
 * Whether the navigator may write views into a URL with this fragment: one without a
 * fragment, or with an svgView one (even a malformed one, which then gets corrected).
 * Any other fragment belongs to the SVG (an element id, say) and is left alone.
 */
export function ownsFragment(hash: string): boolean {
    return hash === '' || hash === '#' || hash.startsWith('#svgView(');
}

// A fragment that isn't valid percent-encoding can't name a view.
function maybeDecode(hash: string): string | null {
    try {
        return decodeURIComponent(hash);
    } catch {
        return null;
    }
}
