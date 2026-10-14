/**
 * Shared steps for the generated marketing images (`appStoreScreenshots.ts` and
 * `readmeHero.ts`): open an example SVG in headless Chrome with the built extension
 * (`.build/chrome`, from `bun run build:dev`), drive it with real mouse input, and
 * render an HTML frame around the capture.
 *
 * Every input is fixed (Puppeteer's pinned Chrome, window size, settings, SVG files,
 * input sequence), so reruns on the same machine produce identical files; captions use
 * the system font, so another OS renders them differently.
 */

import { fileURLToPath } from 'node:url';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import type { Settings } from '../src/shared/settings.ts';
import {
    evaluateInExtension,
    getViewBox,
    launchWithExtension,
    startFixtureServer,
    waitForNavigator,
    waitForViewBoxChange,
} from '../test/e2e/harness.ts';

export interface Point {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

/** What a capture needs once the browser is running. */
export interface CaptureContext {
    browser: Browser;
    extensionOrigin: string;
    /** Serves `examples/`. */
    origin: string;
}

export interface Shot {
    /** A file in `examples/`. */
    svg: string;
    viewport: Size;
    scale: number;
    settings?: Partial<Settings>;
    /** Drives the page into the state to capture. */
    act: (page: Page) => Promise<void>;
}

export const repoRoot = new URL('../', import.meta.url);
export const WORLD_MAP = 'Worldmap_location_NED_50m Public Domain.svg';
/** The host the drawn address bar shows; the map is a Wikimedia Commons file. */
export const DISPLAYED_HOST = 'upload.wikimedia.org';

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

/** Starts the example server and Chrome with the extension, runs `fn`, then shuts both down. */
export async function withCaptureContext(fn: (context: CaptureContext) => Promise<void>): Promise<void> {
    const server = await startFixtureServer(fileURLToPath(new URL('examples/', repoRoot)));
    const { browser, extensionOrigin } = await launchWithExtension('chrome', DETERMINISTIC_RENDERING_ARGS);
    try {
        await fn({ browser, extensionOrigin, origin: server.origin });
    } finally {
        await browser.close();
        await server.close();
    }
}

/**
 * Starts a second Chrome, without the extension, for composing frames while the
 * extension's page stays open: a page in a background tab gets no input, animation
 * frames, or timely timers, so each page needs a browser of its own.
 */
export async function launchComposer(): Promise<Browser> {
    return puppeteer.launch({ headless: true, pipe: true, args: DETERMINISTIC_RENDERING_ARGS });
}

/**
 * The minimap builds its copy of the drawing once the view rests, so a screenshot taken
 * straight after zooming could catch it either way; wait until it's hidden or built.
 */
export async function waitForMinimapToSettle(page: Page): Promise<void> {
    await page.waitForFunction(() => {
        const maybeMinimap = document.querySelector('svg-navigator-hud')?.shadowRoot?.querySelector('.minimap');
        return !maybeMinimap || maybeMinimap.hasAttribute('hidden') || maybeMinimap.querySelector('.minimap-frame') !== null;
    }, { timeout: 10_000 });
}

/** Scrolls up `ticks` times at `point`, waiting for each zoom step to land. */
export async function zoom(page: Page, point: Point, ticks: number): Promise<void> {
    await page.mouse.move(point.x, point.y);
    for (let tick = 0; tick < ticks; tick++) {
        const before = await getViewBox(page);
        await page.mouse.wheel({ deltaY: -100 });
        await waitForViewBoxChange(page, before);
    }
}

/** Drags the image from `from` to `to`. */
export async function pan(page: Page, from: Point, to: Point): Promise<void> {
    const before = await getViewBox(page);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    // Stop before letting go, so the pan doesn't glide on: a glide's length depends on
    // event timing, which would make the screenshots differ from run to run.
    await new Promise((resolve) => setTimeout(resolve, 100));
    await page.mouse.up();
    await waitForViewBoxChange(page, before);
}

export async function preparePage(page: Page, viewport: Size, scale: number): Promise<void> {
    await page.setViewport({ ...viewport, deviceScaleFactor: scale });
    await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: 'light' },
        { name: 'prefers-reduced-motion', value: 'reduce' },
    ]);
}

/**
 * Removes transitions so nothing is caught mid-fade. Not `page.addStyleTag`: it waits
 * for the style's load event, which never fires in an SVG document.
 */
export async function freezeAnimations(page: Page): Promise<void> {
    await page.evaluate(() => {
        const style = document.createElementNS('http://www.w3.org/1999/xhtml', 'style');
        style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
        document.documentElement.appendChild(style);
    });
}

/** Stores `shot.settings`, opens its SVG, acts, and screenshots the page. */
export async function captureShot({ browser, extensionOrigin, origin }: CaptureContext, shot: Shot): Promise<Uint8Array> {
    await evaluateInExtension(browser, extensionOrigin, async (settings: Partial<Settings>) => {
        await chrome.storage.sync.clear();
        await chrome.storage.sync.set(settings);
    }, { toolbarAutoHide: false, ...shot.settings });
    const page = await browser.newPage();
    try {
        await preparePage(page, shot.viewport, shot.scale);
        await page.goto(`${origin}/${encodeURIComponent(shot.svg)}`);
        await waitForNavigator(page);
        await freezeAnimations(page);
        await shot.act(page);
        await waitForMinimapToSettle(page);
        return await page.screenshot({ type: 'png' });
    } finally {
        await page.close();
    }
}

/** Renders `html` at `canvas` size and screenshots it. */
export async function compose(browser: Browser, html: string, canvas: Size, scale: number): Promise<Uint8Array> {
    const page = await browser.newPage();
    try {
        await preparePage(page, canvas, scale);
        await page.setContent(html, { waitUntil: 'load' });
        return await page.screenshot({ type: 'png' });
    } finally {
        await page.close();
    }
}

export const dataUrl = (png: Uint8Array): string => `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
