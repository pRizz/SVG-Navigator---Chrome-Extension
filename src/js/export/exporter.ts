/**
 * Export (#51), the shell side: reads the drawing, renders PNGs, and saves or copies
 * files for the HUD's Export menu. Each action resolves to the status line the menu
 * shows, failures included. Downloads go through blob URLs, so no permission is needed.
 *
 * Exports start from the drawing as authored: a copy with the root attributes the
 * navigator rewrote put back and its zoom box removed. A PNG renders that copy as an
 * image, which a browser draws without its linked resources, so linked images are
 * fetched and embedded first.
 */

import { ZOOM_BOX_ATTRIBUTE } from '../input/pointer';
import { formatViewBox, type ViewBox } from '../viewBox';
import {
    exportBaseName,
    isExternalReference,
    pngFileName,
    pngSavedStatus,
    pngSize,
    svgFileName,
    type PngScale,
    type Size,
} from './exportPlan';

const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
// Long enough for the browser to start the download; a blob URL holds its file in memory.
const DOWNLOAD_URL_LIFETIME_MS = 60_000;
const TOO_LARGE = 'Too large for this browser; try a smaller size';

/** The root attributes the navigator rewrites, so exports can put them back. */
const REWRITTEN_ATTRIBUTES = ['width', 'height', 'viewBox', 'preserveAspectRatio', 'style'] as const;

/** The drawing's rewritten root attributes as authored; null where absent. */
export type AuthoredRoot = Record<typeof REWRITTEN_ATTRIBUTES[number], string | null>;

export interface ExporterOptions {
    drawing: SVGSVGElement;
    authoredRoot: AuthoredRoot;
    view: () => ViewBox;
    /** A link to the current view. */
    link: () => string;
}

export interface Exporter {
    copyLink: () => Promise<string>;
    pngSize: (scale: PngScale) => Size;
    savePng: (scale: PngScale) => Promise<string>;
    downloadSvg: () => Promise<string>;
    copySource: () => Promise<string>;
}

/** Read before the navigator rewrites anything. */
export function readAuthoredRoot(drawing: SVGSVGElement): AuthoredRoot {
    const entries = REWRITTEN_ATTRIBUTES.map((name) => [name, drawing.getAttribute(name)] as const);
    return Object.fromEntries(entries) as AuthoredRoot;
}

export function createExporter({ drawing, authoredRoot, view, link }: ExporterOptions): Exporter {
    const baseName = (): string => exportBaseName(location.href);

    function authoredCopy(): SVGSVGElement {
        const copy = drawing.cloneNode(true) as SVGSVGElement;
        for (const zoomBox of copy.querySelectorAll(`[${ZOOM_BOX_ATTRIBUTE}]`)) {
            zoomBox.remove();
        }
        for (const name of REWRITTEN_ATTRIBUTES) {
            const maybeValue = authoredRoot[name];
            if (maybeValue === null) {
                copy.removeAttribute(name);
            } else {
                copy.setAttribute(name, maybeValue);
            }
        }
        return copy;
    }

    const authoredSource = (): string => new XMLSerializer().serializeToString(authoredCopy());

    function viewPixels(): Size {
        const box = drawing.getBoundingClientRect();
        return { width: box.width, height: box.height };
    }

    async function savePng(scale: PngScale): Promise<string> {
        const size = pngSize(viewPixels(), scale);
        const copy = authoredCopy();
        // The view as shown: the navigator drops preserveAspectRatio, and an authored
        // CSS size would override the attributes.
        copy.setAttribute('viewBox', formatViewBox(view()));
        copy.removeAttribute('preserveAspectRatio');
        for (const dimension of ['width', 'height'] as const) {
            copy.setAttribute(dimension, String(size[dimension]));
            copy.style.setProperty(dimension, `${size[dimension]}px`);
        }
        const leftOut = await embedLinkedImages(copy);
        const fileName = pngFileName(baseName(), scale);
        const maybePng = await renderPng(new XMLSerializer().serializeToString(copy), size);
        if (typeof maybePng === 'string') { return maybePng; }
        saveFile(maybePng, fileName);
        return pngSavedStatus(fileName, leftOut);
    }

    return {
        copyLink: () => copyText(link(), 'Link copied'),
        pngSize: (scale) => pngSize(viewPixels(), scale),
        savePng,
        downloadSvg: () => {
            const fileName = svgFileName(baseName());
            saveFile(new Blob([authoredSource()], { type: 'image/svg+xml' }), fileName);
            return Promise.resolve(`Saved ${fileName}`);
        },
        copySource: () => copyText(authoredSource(), 'SVG source copied'),
    };
}

/** Embeds each linked image the page may fetch; returns how many it couldn't. */
async function embedLinkedImages(copy: SVGSVGElement): Promise<number> {
    const outcomes = await Promise.all([...copy.querySelectorAll('image, feImage')].map(async (image) => {
        const maybeHref = image.getAttribute('href') ?? image.getAttributeNS(XLINK_NS, 'href');
        if (maybeHref === null || !isExternalReference(maybeHref)) { return true; }
        try {
            image.setAttribute('href', await fetchAsDataUrl(new URL(maybeHref, location.href).href));
            image.removeAttributeNS(XLINK_NS, 'href');
            return true;
        } catch (error) {
            console.warn(`SVG Navigator: could not embed ${maybeHref} in the PNG`, error);
            return false;
        }
    }));
    return outcomes.filter((embedded) => !embedded).length;
}

async function fetchAsDataUrl(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('the image did not read as a data URL'));
            }
        };
        reader.onerror = () => reject(reader.error ?? new Error('could not read the image'));
        reader.readAsDataURL(blob);
    });
}

/** The PNG, or the status line saying why there's none. */
async function renderPng(svgText: string, size: Size): Promise<Blob | string> {
    const imageUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    try {
        const image = new Image();
        image.src = imageUrl;
        await image.decode();
        const canvas = document.createElementNS(XHTML_NS, 'canvas') as HTMLCanvasElement;
        canvas.width = size.width;
        canvas.height = size.height;
        const maybeContext = canvas.getContext('2d');
        if (maybeContext === null) { return TOO_LARGE; }
        maybeContext.drawImage(image, 0, 0, size.width, size.height);
        const maybeBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        return maybeBlob ?? TOO_LARGE;
    } catch (error) {
        console.warn('SVG Navigator: could not render the PNG', error);
        return error instanceof DOMException && error.name === 'SecurityError'
            ? 'The browser won\'t save this drawing as a PNG: it shows content from another site'
            : 'The browser couldn\'t draw this SVG as an image';
    } finally {
        URL.revokeObjectURL(imageUrl);
    }
}

function saveFile(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElementNS(XHTML_NS, 'a') as HTMLAnchorElement;
    anchor.href = url;
    anchor.download = fileName;
    // Firefox only follows a link that's in the document.
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
}

// Wrapped so a missing clipboard (an insecure page) rejects instead of throwing.
function copyText(text: string, doneStatus: string): Promise<string> {
    return Promise.resolve()
        .then(() => navigator.clipboard.writeText(text))
        .then(
            () => doneStatus,
            (error: unknown) => {
                console.warn('SVG Navigator: could not copy', error);
                return 'Couldn\'t copy: this page doesn\'t allow it';
            },
        );
}
