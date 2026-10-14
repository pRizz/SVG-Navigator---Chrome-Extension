/**
 * Generates the Mac App Store screenshots in `store/app-store/screenshots/`.
 *
 * Each scene captures the world map with the built extension (see
 * `screenshotCapture.ts`) and places it in a Safari-style window with a caption.
 *
 * Run with `bun run screenshots:app-store`.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import type { Browser, Page } from 'puppeteer';
import type { Settings } from '../src/shared/settings.ts';
import { fillTemplate } from './fillTemplate.ts';
import {
    captureShot,
    compose,
    dataUrl,
    DISPLAYED_HOST,
    freezeAnimations,
    pan,
    preparePage,
    repoRoot,
    withCaptureContext,
    WORLD_MAP,
    zoom,
} from './screenshotCapture.ts';
import { openOptionsPage } from '../test/e2e/harness.ts';

/** App Store Connect accepts 2880×1800 for Mac screenshots: 1440×900 at 2x. */
const CANVAS = { width: 1440, height: 900, scale: 2 } as const;
/** The page area inside the drawn browser window. */
const VIEWPORT = { width: 1240, height: 640 } as const;

const outputDir = new URL('store/app-store/screenshots/', repoRoot);

interface Scene {
    fileName: string;
    title: string;
    subtitle: string;
    settings?: Partial<Settings>;
    /** Drives the page into the state to capture. */
    act: (page: Page) => Promise<void>;
    /** Shows the options popup over the page. */
    withPopup?: boolean;
}

const SCENES: Scene[] = [
    {
        fileName: '01-infinite-zoom.png',
        title: 'Infinite zoom for any SVG in Safari',
        subtitle: 'Open an SVG file and explore it like a map.',
        act: async (page) => {
            await zoom(page, { x: 680, y: 200 }, 4);
        },
    },
    {
        fileName: '02-scroll-to-zoom.png',
        title: 'Scroll to zoom in infinitely',
        subtitle: 'Vector graphics stay sharp at every level. Drag to pan, press Esc to reset.',
        act: async (page) => {
            await zoom(page, { x: 620, y: 175 }, 7);
            await pan(page, { x: 620, y: 320 }, { x: 560, y: 380 });
        },
    },
    {
        fileName: '03-zoom-box.png',
        title: 'Drag a box to zoom right to it',
        subtitle: 'Switch click-and-drag from panning to a zoom box.',
        settings: { clickAndDragBehavior: 'zoomBox' },
        act: async (page) => {
            // Captured mid-drag, so the zoom box is still on screen.
            await page.mouse.move(930, 175);
            await page.mouse.down();
            await page.mouse.move(1080, 300, { steps: 10 });
        },
    },
    {
        fileName: '04-settings.png',
        title: 'Make it work your way',
        subtitle: 'Choose the drag behavior, scroll sensitivity, on-screen controls, and background.',
        act: async (page) => {
            await zoom(page, { x: 400, y: 260 }, 2);
        },
        withPopup: true,
    },
];

/** Captures the options popup showing the settings the current scene stored. */
async function capturePopup(browser: Browser, extensionOrigin: string): Promise<Uint8Array> {
    const page = await browser.newPage();
    try {
        await preparePage(page, { width: 420, height: 600 }, CANVAS.scale);
        await openOptionsPage(page, extensionOrigin);
        await freezeAnimations(page);
        // The commit and build time change on every build.
        await page.$eval('#versionInfo', (footer) => {
            footer.textContent = `Version ${chrome.runtime.getManifest().version}`;
        });
        return await page.screenshot({ type: 'png', fullPage: true });
    } finally {
        await page.close();
    }
}

/** Lays out the caption and a Safari-style window around the captured page. */
function composeHtml(frame: string, scene: Scene, page: string, toolbarIcon: string, maybePopup: string | undefined): string {
    return fillTemplate(frame, {
        canvasWidth: String(CANVAS.width),
        canvasHeight: String(CANVAS.height),
        viewportWidth: String(VIEWPORT.width),
        viewportHeight: String(VIEWPORT.height),
        title: scene.title,
        subtitle: scene.subtitle,
        displayedHost: DISPLAYED_HOST,
        toolbarIcon,
        page,
        // The frame hides its popover when this is empty.
        popup: maybePopup ?? '',
    });
}

async function main(): Promise<void> {
    await withCaptureContext(async (context) => {
        const frame = await readFile(new URL('scripts/appStoreScreenshotFrame.html', repoRoot), 'utf8');
        const toolbarIcon = dataUrl(await readFile(new URL('src/icon_38.png', repoRoot)));
        await rm(outputDir, { recursive: true, force: true });
        await mkdir(outputDir, { recursive: true });
        for (const scene of SCENES) {
            const page = dataUrl(await captureShot(context, {
                svg: WORLD_MAP,
                viewport: VIEWPORT,
                scale: CANVAS.scale,
                settings: scene.settings,
                act: scene.act,
            }));
            const maybePopup = scene.withPopup ? dataUrl(await capturePopup(context.browser, context.extensionOrigin)) : undefined;
            const html = composeHtml(frame, scene, page, toolbarIcon, maybePopup);
            await writeFile(new URL(scene.fileName, outputDir), await compose(context.browser, html, CANVAS, CANVAS.scale));
            console.log(`Wrote store/app-store/screenshots/${scene.fileName}`);
        }
    });
}

await main();
