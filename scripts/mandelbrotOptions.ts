import { parseArgs } from 'node:util';
import type { MandelbrotOptions, MandelbrotStyle } from './mandelbrot.ts';

/** A named view of the plane. */
interface Preset {
    readonly centerRe: number;
    readonly centerIm: number;
    readonly span: number;
    readonly maxIterations: number;
    readonly description: string;
}

export const PRESETS = {
    full: { centerRe: -0.75, centerIm: 0, span: 3, maxIterations: 200, description: 'the whole set' },
    seahorse: { centerRe: -0.7453, centerIm: 0.1127, span: 0.0065, maxIterations: 600, description: 'Seahorse Valley, between the cardioid and the period-2 bulb' },
    elephant: { centerRe: 0.2925, centerIm: 0.0149, span: 0.0275, maxIterations: 500, description: 'Elephant Valley, on the cardioid\'s right' },
    spiral: { centerRe: -0.08881, centerIm: 0.65482, span: 0.0012, maxIterations: 1500, description: 'a double spiral in the valley above the cardioid' },
    minibrot: { centerRe: -1.7685, centerIm: 0, span: 0.065, maxIterations: 400, description: 'the period-3 mini Mandelbrot on the real axis' },
} as const satisfies Record<string, Preset>;

export type PresetName = keyof typeof PRESETS;

/** Gradient stops for each palette; each wraps around from its last stop to its first. */
export const PALETTES = {
    classic: ['#000764', '#206bcb', '#edffff', '#ffaa00', '#000200'],
    fire: ['#1a0000', '#7a0a00', '#e8460c', '#ffb627', '#fff6c2'],
    ocean: ['#03045e', '#0077b6', '#00b4d8', '#90e0ef', '#caf0f8'],
    rainbow: ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'],
    grayscale: ['#202020', '#f0f0f0'],
} as const satisfies Record<string, readonly string[]>;

export type PaletteName = keyof typeof PALETTES;

const STYLES: Readonly<Record<MandelbrotStyle, string>> = {
    pixels: 'a rectangle per pixel, merged along rows',
    curves: 'smooth ribbons traced along each band\'s edges',
};

/** One image to write: its name (the default file name) and what it looks like. */
export interface MandelbrotRender {
    readonly name: string;
    readonly options: MandelbrotOptions;
    readonly maybeOutputPath: string | null;
}

export type MandelbrotCommand =
    | { readonly kind: 'help' }
    | { readonly kind: 'render', readonly renders: readonly MandelbrotRender[] };

const DEFAULTS = {
    preset: 'full',
    style: 'pixels',
    width: 900,
    height: 600,
    palette: 'classic',
    bands: 64,
    cycle: 48,
    interior: '#000000',
    curveDetail: 4,
} as const;

/** The most samples along either side, which keeps an image within reach of a browser. */
const MAX_SIDE = 20000;

export const USAGE = `Usage: bun run mandelbrot [options]

Writes a Mandelbrot set SVG (by default to generated/mandelbrot/<name>.svg).

Options:
  --preset <name>         ${Object.keys(PRESETS).join(', ')} (default: ${DEFAULTS.preset})
  --gallery               render every preset, one file each
  --style <name>          pixels or curves (default: ${DEFAULTS.style}); curves adds
                          -curves to the file name
  --curve-detail <n>      for curves, the most band edges between neighboring
                          samples; higher keeps more filaments and makes larger
                          files (default: ${DEFAULTS.curveDetail})
  --center=<re>,<im>      center of the view, e.g. --center=-0.75,0 (the = is
                          needed when the value starts with a minus sign)
  --span <number>         width of the view in the complex plane
  --iterations <n>        max iterations before a point counts as inside
  --width <n>             horizontal samples (default: ${DEFAULTS.width})
  --height <n>            vertical samples (default: ${DEFAULTS.height})
  --resolution <n>        multiply the sample count by n (each side by √n), and
                          add -<n>x to the file name, e.g. --resolution 10
  --palette <name>        ${Object.keys(PALETTES).join(', ')} (default: ${DEFAULTS.palette})
  --bands <n>             distinct colors (default: ${DEFAULTS.bands})
  --cycle <n>             escape iterations per trip around the palette (default: ${DEFAULTS.cycle})
  --interior <#rrggbb>    color of the set itself (default: ${DEFAULTS.interior})
  --output <path>         file to write
  --help                  show this help

Styles:
${Object.entries(STYLES).map(([name, description]) => `  ${name.padEnd(10)} ${description}`).join('\n')}

Presets:
${Object.entries(PRESETS).map(([name, preset]) => `  ${name.padEnd(10)} ${preset.description}`).join('\n')}
`;

/** Parses command-line arguments into the images to render. */
export function parseMandelbrotArgs(args: readonly string[]): MandelbrotCommand {
    const { values } = parseArgs({
        args: [...args],
        strict: true,
        allowPositionals: false,
        options: {
            preset: { type: 'string' },
            gallery: { type: 'boolean' },
            style: { type: 'string' },
            'curve-detail': { type: 'string' },
            center: { type: 'string' },
            span: { type: 'string' },
            iterations: { type: 'string' },
            width: { type: 'string' },
            height: { type: 'string' },
            resolution: { type: 'string' },
            palette: { type: 'string' },
            bands: { type: 'string' },
            cycle: { type: 'string' },
            interior: { type: 'string' },
            output: { type: 'string' },
            help: { type: 'boolean' },
        },
    });
    if (values.help === true) {
        return { kind: 'help' };
    }
    if (values.gallery === true && (values.preset !== undefined || values.output !== undefined)) {
        throw new Error('--gallery renders every preset to its own file; it cannot take --preset or --output');
    }

    const maybeCenter = values.center === undefined ? null : parseCenter(values.center);
    const isCustomView = maybeCenter !== null || values.span !== undefined;
    const resolution = parsePositiveNumber('--resolution', values.resolution ?? '1');
    const style = parseName('--style', values.style ?? DEFAULTS.style, STYLES);
    const shared = {
        style,
        width: scaledSide('--width', values.width ?? String(DEFAULTS.width), resolution),
        height: scaledSide('--height', values.height ?? String(DEFAULTS.height), resolution),
        paletteStops: PALETTES[parseName('--palette', values.palette ?? DEFAULTS.palette, PALETTES)],
        bands: parseInteger('--bands', values.bands ?? String(DEFAULTS.bands), 1, 4096),
        cycle: parsePositiveNumber('--cycle', values.cycle ?? String(DEFAULTS.cycle)),
        interiorColor: parseColor('--interior', values.interior ?? DEFAULTS.interior),
        curveDetail: parsePositiveNumber('--curve-detail', values['curve-detail'] ?? String(DEFAULTS.curveDetail)),
    };
    const presetNames = values.gallery === true
        ? Object.keys(PRESETS) as PresetName[]
        : [parseName('--preset', values.preset ?? DEFAULTS.preset, PRESETS)];

    const renders = presetNames.map((presetName): MandelbrotRender => {
        const preset: Preset = PRESETS[presetName];
        // A changed view is no longer the preset's picture, so it must not overwrite the preset's file.
        const viewName = isCustomView && values.gallery !== true && values.preset === undefined ? 'custom' : presetName;
        return {
            name: [viewName, style === 'curves' ? '-curves' : '', resolution === 1 ? '' : `-${resolution}x`].join(''),
            maybeOutputPath: values.output ?? null,
            options: {
                ...shared,
                centerRe: maybeCenter?.re ?? preset.centerRe,
                centerIm: maybeCenter?.im ?? preset.centerIm,
                span: values.span === undefined ? preset.span : parsePositiveNumber('--span', values.span),
                maxIterations: values.iterations === undefined
                    ? preset.maxIterations
                    : parseInteger('--iterations', values.iterations, 1, 1_000_000),
            },
        };
    });
    return { kind: 'render', renders };
}

/** A side's sample count, from its flag, scaled so the image has `resolution` times the samples. */
function scaledSide(flag: string, text: string, resolution: number): number {
    const side = Math.round(parseInteger(flag, text, 1, MAX_SIDE) * Math.sqrt(resolution));
    if (side < 1 || side > MAX_SIDE) {
        throw new Error(`${flag} ${text} at --resolution ${resolution} gives ${side} samples; the limit is 1 to ${MAX_SIDE}`);
    }
    return side;
}

function parseCenter(text: string): { re: number, im: number } {
    const parts = text.split(',');
    if (parts.length !== 2) {
        throw new Error(`--center expects <re>,<im>, got "${text}"`);
    }
    const [re, im] = parts.map((part) => parseFiniteNumber('--center', part));
    return { re: re ?? 0, im: im ?? 0 };
}

function parseFiniteNumber(flag: string, text: string): number {
    const value = Number(text.trim());
    if (text.trim() === '' || !Number.isFinite(value)) {
        throw new Error(`${flag} expects a number, got "${text}"`);
    }
    return value;
}

function parsePositiveNumber(flag: string, text: string): number {
    const value = parseFiniteNumber(flag, text);
    if (value <= 0) {
        throw new Error(`${flag} must be greater than 0, got ${text}`);
    }
    return value;
}

function parseInteger(flag: string, text: string, min: number, max: number): number {
    const value = parseFiniteNumber(flag, text);
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`${flag} expects a whole number from ${min} to ${max}, got ${text}`);
    }
    return value;
}

function parseName<T extends string>(flag: string, text: string, choices: Readonly<Record<T, unknown>>): T {
    if (!Object.hasOwn(choices, text)) {
        throw new Error(`${flag} must be one of ${Object.keys(choices).join(', ')}; got "${text}"`);
    }
    return text as T;
}

function parseColor(flag: string, text: string): string {
    if (!/^#[0-9a-f]{6}$/i.test(text)) {
        throw new Error(`${flag} expects a #rrggbb color, got "${text}"`);
    }
    return text;
}
