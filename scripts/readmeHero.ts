/**
 * Generates the README's main image, `docs/images/readme-hero.png`: the world map,
 * zoomed in with the built extension (see `screenshotCapture.ts`), in a browser window
 * that doesn't belong to any one browser.
 *
 * Run with `bun run screenshots:readme`.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fillTemplate } from './fillTemplate.ts';
import {
    captureShot,
    compose,
    dataUrl,
    DISPLAYED_HOST,
    repoRoot,
    withCaptureContext,
    WORLD_MAP,
    zoom,
} from './screenshotCapture.ts';

/** 2560×1440: 16:9, sharp on high-density screens. */
const CANVAS = { width: 1280, height: 720, scale: 2 } as const;
/** The page area inside the drawn browser window, short enough to leave a margin below it. */
const VIEWPORT = { width: 1120, height: 480 } as const;

const outputDir = new URL('docs/images/', repoRoot);
const FILE_NAME = 'readme-hero.png';

async function main(): Promise<void> {
    await withCaptureContext(async (context) => {
        const page = dataUrl(await captureShot(context, {
            svg: WORLD_MAP,
            viewport: VIEWPORT,
            scale: CANVAS.scale,
            act: async (mapPage) => {
                await zoom(mapPage, { x: 615, y: 150 }, 4);
            },
        }));
        const frame = await readFile(new URL('scripts/readmeHeroFrame.html', repoRoot), 'utf8');
        const html = fillTemplate(frame, {
            canvasWidth: String(CANVAS.width),
            canvasHeight: String(CANVAS.height),
            viewportWidth: String(VIEWPORT.width),
            viewportHeight: String(VIEWPORT.height),
            title: 'Infinite zoom for any SVG',
            subtitle: 'Scroll into any detail and drag to pan, in Chrome, Firefox, and Safari.',
            displayedHost: DISPLAYED_HOST,
            toolbarIcon: dataUrl(await readFile(new URL('src/icon_38.png', repoRoot))),
            page,
        });
        await mkdir(outputDir, { recursive: true });
        await writeFile(new URL(FILE_NAME, outputDir), await compose(context.browser, html, CANVAS, CANVAS.scale));
        console.log(`Wrote docs/images/${FILE_NAME}`);
    });
}

await main();
