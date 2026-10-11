import { pixelLayers, type MandelbrotOptions } from './mandelbrot.ts';
import { curveLayers } from './mandelbrotCurves.ts';

/** A rendered image, with counts for logging. */
export interface MandelbrotSvg {
    readonly svg: string;
    readonly pathCount: number;
    /** The shapes across all paths: rectangles for `pixels`, closed loops for `curves`. */
    readonly shapeCount: number;
}

/** Renders the image described by `options`, with `title` as its accessible name. */
export function renderMandelbrotSvg(options: MandelbrotOptions, title: string): MandelbrotSvg {
    const { width, height } = options;
    const drawing = options.style === 'pixels'
        ? { ...pixelLayers(options), backgroundColor: options.interiorColor, rootAttributes: 'shape-rendering="crispEdges"' }
        : { ...curveLayers(options), rootAttributes: 'fill-rule="evenodd"' };
    const shapeCount = 'rectangleCount' in drawing ? drawing.rectangleCount : drawing.loopCount;
    const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ${drawing.rootAttributes}>`,
        `<title>${escapeXml(title)}</title>`,
        `<desc>${escapeXml(describe(options))}</desc>`,
        `<rect width="${width}" height="${height}" fill="${drawing.backgroundColor}"/>`,
        ...drawing.paths,
        '</svg>',
        '',
    ].join('\n');
    return { svg, pathCount: drawing.paths.length, shapeCount };
}

/** A one-line record of the parameters, so an image says how to regenerate it. */
export function describe(options: MandelbrotOptions): string {
    return [
        `Mandelbrot set centered on ${options.centerRe} + ${options.centerIm}i`,
        `span ${options.span}`,
        `${options.width}×${options.height} samples drawn as ${options.style === 'curves' ? `curves (detail ${options.curveDetail})` : 'pixels'}`,
        `${options.maxIterations} max iterations`,
        `${options.bands} bands cycling every ${options.cycle} iterations`,
    ].join(', ');
}

function escapeXml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
