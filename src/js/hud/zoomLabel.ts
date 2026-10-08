/**
 * The HUD's zoom readout. Zoom is unbounded, so the label stays short at any level:
 * whole percents, then compact notation (`12K%`), then an exponent (`1.2e20%`).
 */

const COMPACT_FROM_PERCENT = 10_000;
const EXPONENT_FROM_PERCENT = 1e15;

// A fixed locale keeps the label (and the App Store screenshots) identical everywhere.
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/** Formats a zoom ratio (1 = the original view) as a percentage. */
export function zoomLabel(ratio: number): string {
    const percent = ratio * 100;
    // A view narrower than the smallest double divides into Infinity; 0 by 0 gives NaN.
    if (Number.isNaN(percent)) {
        return '—';
    }
    if (percent === Infinity) {
        return '∞%';
    }
    if (percent < 1) {
        return `${Number(percent.toPrecision(2))}%`;
    }
    // Compare after rounding, so 9,999.6% reads 10K% rather than 10000%.
    const wholePercent = Math.round(percent);
    if (wholePercent < COMPACT_FROM_PERCENT) {
        return `${wholePercent}%`;
    }
    if (percent < EXPONENT_FROM_PERCENT) {
        return `${compactFormat.format(percent)}%`;
    }
    const [mantissa = '', exponent = ''] = percent.toExponential(1).split('e+');
    return `${mantissa}e${exponent}%`;
}
