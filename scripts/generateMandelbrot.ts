import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, renderMandelbrotSvg } from './mandelbrotSvg.ts';
import { parseMandelbrotArgs, USAGE, type MandelbrotRender } from './mandelbrotOptions.ts';

const outputDir = fileURLToPath(new URL('../generated/mandelbrot/', import.meta.url));

function writeRender(render: MandelbrotRender): void {
    const outputPath = path.resolve(render.maybeOutputPath ?? path.join(outputDir, `${render.name}.svg`));
    console.log(`mandelbrot: rendering "${render.name}": ${describe(render.options)}`);
    const started = performance.now();
    const { svg, pathCount, shapeCount } = renderMandelbrotSvg(render.options, `Mandelbrot set (${render.name})`);
    const seconds = ((performance.now() - started) / 1000).toFixed(2);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, svg);
    const kilobytes = Math.round(Buffer.byteLength(svg) / 1024);
    console.log(`mandelbrot: ${pathCount} paths, ${shapeCount} ${render.options.style === 'pixels' ? 'rectangles' : 'loops'}, ${kilobytes} KB in ${seconds}s`);
    console.log(`mandelbrot: wrote ${pathToFileURL(outputPath).href}`);
}

let command;
try {
    command = parseMandelbrotArgs(process.argv.slice(2));
} catch (error) {
    console.error(`mandelbrot: ${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
    process.exit(1);
}
if (command.kind === 'help') {
    console.log(USAGE);
} else {
    command.renders.forEach(writeRender);
}
