/**
 * Renders the Mandelbrot set: a fun, heavy drawing to try SVG Navigator on.
 *
 * Each pixel of a `width`×`height` grid samples the complex plane, and its smoothed
 * escape time picks one of the palette's color bands. In the `pixels` style,
 * horizontal runs of one band merge into a rectangle, and every band becomes a
 * single `<path>` of those rectangles, so the element count stays at the band count
 * however large the grid. Points inside the set are the background and draw nothing.
 * `mandelbrotCurves.ts` draws the `curves` style, and `mandelbrotSvg.ts` wraps either.
 */

/** How the bands are drawn: pixel rectangles, or smooth traced ribbons. */
export type MandelbrotStyle = 'pixels' | 'curves';

/** Everything that decides what an image looks like. */
export interface MandelbrotOptions {
    readonly style: MandelbrotStyle;
    /** Horizontal samples, which is also the SVG's user-unit width. */
    readonly width: number;
    /** Vertical samples, which is also the SVG's user-unit height. */
    readonly height: number;
    /** Real part of the complex point at the image's center. */
    readonly centerRe: number;
    /** Imaginary part of the complex point at the image's center. */
    readonly centerIm: number;
    /** Width of the complex-plane window; its height follows the image's aspect ratio. */
    readonly span: number;
    /** Iterations after which a point counts as inside the set. */
    readonly maxIterations: number;
    /** Colors of the band gradient, as `#rrggbb`; it wraps from the last back to the first. */
    readonly paletteStops: readonly string[];
    /** Distinct colors the gradient is cut into. */
    readonly bands: number;
    /** Escape iterations one trip around the palette covers. */
    readonly cycle: number;
    /** Background color, which is also the color of the set itself. */
    readonly interiorColor: string;
    /**
     * For `curves`: the most band edges that may cross between neighboring samples.
     * Higher keeps more of the filaments near the set and makes larger files.
     */
    readonly curveDetail: number;
}

/** Marks a pixel inside the set in a band raster. */
const INTERIOR = -1;

// Escaping at |z| > 256 rather than 2 makes the smoothed count accurate.
const ESCAPE_RADIUS_SQUARED = 256 * 256;

/**
 * The smoothed (fractional) escape time of `c = re + im·i`, or null when the
 * point stays bounded for `maxIterations` and so counts as inside the set.
 */
export function maybeEscapeTime(re: number, im: number, maxIterations: number): number | null {
    if (isInMainCardioidOrBulb(re, im)) {
        return null;
    }
    let zRe = 0;
    let zIm = 0;
    for (let iteration = 0; iteration < maxIterations; iteration++) {
        const zReSquared = zRe * zRe;
        const zImSquared = zIm * zIm;
        const magnitudeSquared = zReSquared + zImSquared;
        if (magnitudeSquared > ESCAPE_RADIUS_SQUARED) {
            return iteration + 1 - Math.log2(Math.log(magnitudeSquared) / 2);
        }
        zIm = 2 * zRe * zIm + im;
        zRe = zReSquared - zImSquared + re;
    }
    return null;
}

/**
 * Whether `c` lies in the main cardioid or the period-2 bulb, which are inside
 * the set: the largest interior areas, skipped without iterating.
 */
function isInMainCardioidOrBulb(re: number, im: number): boolean {
    const imSquared = im * im;
    const offsetRe = re - 0.25;
    const q = offsetRe * offsetRe + imSquared;
    if (q * (q + offsetRe) <= 0.25 * imSquared) {
        return true;
    }
    const bulbRe = re + 1;
    return bulbRe * bulbRe + imSquared <= 1 / 16;
}

/** The palette band a smoothed escape time falls in. */
export function bandForEscapeTime(escapeTime: number, bands: number, cycle: number): number {
    const band = Math.floor((escapeTime / cycle) * bands) % bands;
    // A smoothed count just under zero (a point that escapes at once) wraps to the last band.
    return band < 0 ? band + bands : band;
}

/**
 * Each pixel's band, row by row from the top, or `INTERIOR` inside the set.
 * Pixels sample their centers; the imaginary axis points up.
 */
export function rasterizeBands(options: MandelbrotOptions): Int16Array {
    const { width, height, centerRe, centerIm, span, maxIterations, bands, cycle } = options;
    const step = span / width;
    const left = centerRe - span / 2;
    const top = centerIm + (step * height) / 2;
    const raster = new Int16Array(width * height);
    for (let row = 0; row < height; row++) {
        const im = top - (row + 0.5) * step;
        for (let column = 0; column < width; column++) {
            const maybeTime = maybeEscapeTime(left + (column + 0.5) * step, im, maxIterations);
            raster[row * width + column] = maybeTime === null ? INTERIOR : bandForEscapeTime(maybeTime, bands, cycle);
        }
    }
    return raster;
}

/** `count` colors evenly spaced around the closed gradient through `stops`. */
export function bandColors(stops: readonly string[], count: number): string[] {
    const rgbStops = stops.map(parseHexColor);
    return Array.from({ length: count }, (_, index) => {
        const position = (index / count) * rgbStops.length;
        const stopIndex = Math.floor(position);
        const from = rgbStops[stopIndex] ?? [0, 0, 0];
        const to = rgbStops[(stopIndex + 1) % rgbStops.length] ?? from;
        const t = position - stopIndex;
        return formatHexColor(from.map((channel, i) => channel + ((to[i] ?? channel) - channel) * t));
    });
}

function parseHexColor(hex: string): number[] {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (match === null) {
        throw new Error(`Expected a #rrggbb color, got "${hex}"`);
    }
    return match.slice(1).map((pair) => parseInt(pair, 16));
}

function formatHexColor(channels: readonly number[]): string {
    return `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Path data for each band, keyed by band: one `M x y h w v 1 h -w z` rectangle per
 * horizontal run of that band.
 */
export function bandPaths(raster: Int16Array, width: number): Map<number, string[]> {
    const paths = new Map<number, string[]>();
    const height = raster.length / width;
    for (let row = 0; row < height; row++) {
        let runStart = 0;
        while (runStart < width) {
            const band = raster[row * width + runStart] ?? INTERIOR;
            let runEnd = runStart + 1;
            while (runEnd < width && raster[row * width + runEnd] === band) {
                runEnd++;
            }
            if (band !== INTERIOR) {
                const runs = paths.get(band) ?? [];
                runs.push(`M${runStart} ${row}h${runEnd - runStart}v1h${runStart - runEnd}z`);
                paths.set(band, runs);
            }
            runStart = runEnd;
        }
    }
    return paths;
}

/** The drawing for the `pixels` style: one `<path>` per band that appears. */
export function pixelLayers(options: MandelbrotOptions): { paths: string[], rectangleCount: number } {
    const colors = bandColors(options.paletteStops, options.bands);
    const pathsByBand = bandPaths(rasterizeBands(options), options.width);
    const sortedBands = [...pathsByBand.keys()].sort((a, b) => a - b);
    return {
        paths: sortedBands.map((band) => `<path fill="${colors[band]}" d="${pathsByBand.get(band)?.join('') ?? ''}"/>`),
        rectangleCount: sortedBands.reduce((total, band) => total + (pathsByBand.get(band)?.length ?? 0), 0),
    };
}
