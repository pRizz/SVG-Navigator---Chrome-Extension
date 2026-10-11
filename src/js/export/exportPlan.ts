/**
 * Export (#51): file names, PNG sizes, and status text for the HUD's Export menu.
 * Pure; `exporter.ts` reads the drawing and saves the files.
 */

export interface Size {
    width: number;
    height: number;
}

/** PNG sizes offered, as multiples of the view's size on screen. */
export const PNG_SCALES = [1, 2, 4] as const;
export type PngScale = typeof PNG_SCALES[number];

const FALLBACK_NAME = 'drawing';
const SVG_EXTENSION = /\.svgz?$/i;
// Characters Windows, macOS, or Linux won't take in a file name.
const UNSAFE_IN_FILE_NAMES = /[\\/:*?"<>|]/g;

/** The name exports share: the SVG's file name without its extension. */
export function exportBaseName(href: string): string {
    const url = new URL(href);
    if (url.protocol === 'data:' || url.protocol === 'blob:') { return FALLBACK_NAME; }
    const lastSegment = url.pathname.split('/').at(-1) ?? '';
    const name = maybeDecode(lastSegment).replace(SVG_EXTENSION, '').replace(UNSAFE_IN_FILE_NAMES, '-').trim();
    return name === '' ? FALLBACK_NAME : name;
}

export function svgFileName(baseName: string): string {
    return `${baseName}.svg`;
}

export function pngFileName(baseName: string, scale: PngScale): string {
    return scale === 1 ? `${baseName}.png` : `${baseName}@${scale}x.png`;
}

/** The PNG's size in pixels: the view's size on screen in CSS pixels, times `scale`. */
export function pngSize(viewPixels: Size, scale: PngScale): Size {
    return {
        width: Math.max(1, Math.round(viewPixels.width * scale)),
        height: Math.max(1, Math.round(viewPixels.height * scale)),
    };
}

/**
 * Whether an `href` points outside the drawing: a browser rendering the drawing as an
 * image leaves such references out, so the exporter embeds them first.
 */
export function isExternalReference(href: string): boolean {
    const trimmed = href.trim();
    return trimmed !== '' && !trimmed.startsWith('#') && !/^data:/i.test(trimmed);
}

export function pngSavedStatus(fileName: string, leftOutImages: number): string {
    if (leftOutImages === 0) { return `Saved ${fileName}`; }
    const images = leftOutImages === 1 ? '1 linked image' : `${leftOutImages} linked images`;
    return `Saved ${fileName} without ${images} that couldn't be loaded`;
}

// A name that isn't valid percent-encoding is used as it is.
function maybeDecode(text: string): string {
    try {
        return decodeURIComponent(text);
    } catch {
        return text;
    }
}
