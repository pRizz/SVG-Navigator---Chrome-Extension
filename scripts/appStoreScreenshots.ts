/**
 * Generates the Mac App Store screenshots in `store/app-store/screenshots/`.
 *
 * Each scene opens an example SVG in headless Chrome with the built extension
 * (`.build/chrome`, from `bun run build:dev`), drives it with real mouse input, and
 * places the capture in a Safari-style window with a caption. Every input is fixed
 * (Puppeteer's pinned Chrome, window size, settings, SVG files, input sequence), so
 * reruns on the same machine produce identical files; captions use the system font,
 * so another OS renders them differently.
 *
 * Run with `bun run screenshots:app-store`.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'puppeteer';
import type { Settings } from '../src/shared/settings.ts';
import { fillTemplate } from './fillTemplate.ts';
import {
    evaluateInExtension,
    getViewBox,
    launchWithExtension,
    openOptionsPage,
    startFixtureServer,
    waitForNavigator,
    waitForViewBoxChange,
} from '../test/e2e/harness.ts';

/** App Store Connect accepts 2880×1800 for Mac screenshots: 1440×900 at 2x. */
const CANVAS = { width: 1440, height: 900, scale: 2 } as const;
/** The page area inside the drawn browser window. */
const VIEWPORT = { width: 1240, height: 640 } as const;

const repoRoot = new URL('../', import.meta.url);
const outputDir = new URL('store/app-store/screenshots/', repoRoot);
const MAP = 'Worldmap_location_NED_50m Public Domain.svg';
/**
 * Chrome's GPU and multi-threaded rasterization can differ by a few levels between
 * runs (visible as tile-shaped noise in gradients), so render on one CPU thread.
 */
const DETERMINISTIC_RENDERING_ARGS = [
    '--disable-gpu',
    '--disable-gpu-rasterization',
    '--num-raster-threads=1',
    '--force-color-profile=srgb',
];
const DISPLAYED_HOST = 'upload.wikimedia.org';

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

/** Scrolls up `ticks` times at `point`, waiting for each zoom step to land. */
async function zoom(page: Page, point: { x: number, y: number }, ticks: number): Promise<void> {
    await page.mouse.move(point.x, point.y);
    for (let tick = 0; tick < ticks; tick++) {
        const before = await getViewBox(page);
        await page.mouse.wheel({ deltaY: -100 });
        await waitForViewBoxChange(page, before);
    }
}

/** Drags the image from `from` to `to`. */
async function pan(page: Page, from: { x: number, y: number }, to: { x: number, y: number }): Promise<void> {
    const before = await getViewBox(page);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
    await waitForViewBoxChange(page, before);
}

async function preparePage(page: Page, viewport: { width: number, height: number }): Promise<void> {
    await page.setViewport({ ...viewport, deviceScaleFactor: CANVAS.scale });
    await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: 'light' },
        { name: 'prefers-reduced-motion', value: 'reduce' },
    ]);
}

/**
 * Removes transitions so nothing is caught mid-fade. Not `page.addStyleTag`: it waits
 * for the style's load event, which never fires in an SVG document.
 */
async function freezeAnimations(page: Page): Promise<void> {
    await page.evaluate(() => {
        const style = document.createElementNS('http://www.w3.org/1999/xhtml', 'style');
        style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
        document.documentElement.appendChild(style);
    });
}

async function captureScene(browser: Browser, extensionOrigin: string, origin: string, scene: Scene): Promise<Uint8Array> {
    await evaluateInExtension(browser, extensionOrigin, async (settings: Partial<Settings>) => {
        await chrome.storage.sync.clear();
        await chrome.storage.sync.set(settings);
    }, { toolbarAutoHide: false, ...scene.settings });
    const page = await browser.newPage();
    try {
        await preparePage(page, VIEWPORT);
        await page.goto(`${origin}/${encodeURIComponent(MAP)}`);
        await waitForNavigator(page);
        await freezeAnimations(page);
        await scene.act(page);
        return await page.screenshot({ type: 'png' });
    } finally {
        await page.close();
    }
}

/** Captures the options popup showing the settings the current scene stored. */
async function capturePopup(browser: Browser, extensionOrigin: string): Promise<Uint8Array> {
    const page = await browser.newPage();
    try {
        await preparePage(page, { width: 420, height: 600 });
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

const dataUrl = (png: Uint8Array): string => `data:image/png;base64,${Buffer.from(png).toString('base64')}`;

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

async function compose(browser: Browser, html: string): Promise<Uint8Array> {
    const page = await browser.newPage();
    try {
        await preparePage(page, CANVAS);
        await page.setContent(html, { waitUntil: 'load' });
        return await page.screenshot({ type: 'png' });
    } finally {
        await page.close();
    }
}

async function main(): Promise<void> {
    const server = await startFixtureServer(fileURLToPath(new URL('examples/', repoRoot)));
    const { browser, extensionOrigin } = await launchWithExtension('chrome', DETERMINISTIC_RENDERING_ARGS);
    try {
        const frame = await readFile(new URL('scripts/appStoreScreenshotFrame.html', repoRoot), 'utf8');
        const toolbarIcon = dataUrl(await readFile(new URL('src/icon_38.png', repoRoot)));
        await rm(outputDir, { recursive: true, force: true });
        await mkdir(outputDir, { recursive: true });
        for (const scene of SCENES) {
            const page = dataUrl(await captureScene(browser, extensionOrigin, server.origin, scene));
            const maybePopup = scene.withPopup ? dataUrl(await capturePopup(browser, extensionOrigin)) : undefined;
            const png = await compose(browser, composeHtml(frame, scene, page, toolbarIcon, maybePopup));
            await writeFile(new URL(scene.fileName, outputDir), png);
            console.log(`Wrote store/app-store/screenshots/${scene.fileName}`);
        }
    } finally {
        await browser.close();
        await server.close();
    }
}

await main();
