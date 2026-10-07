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
        fileName: '01-pan-and-zoom.png',
        title: 'Pan and zoom any SVG in Safari',
        subtitle: 'Open an SVG file and explore it like a map.',
        act: async (page) => {
            await zoom(page, { x: 680, y: 200 }, 4);
        },
    },
    {
        fileName: '02-scroll-to-zoom.png',
        title: 'Scroll to zoom into the details',
        subtitle: 'Drag to pan, press Esc to reset, or use the toolbar.',
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
        subtitle: 'Choose the drag behavior, scroll sensitivity, toolbar, and background.',
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
        // The build timestamp changes on every build.
        await page.$eval('#versionInfo', (footer) => {
            footer.textContent = `Version ${chrome.runtime.getManifest().version}`;
        });
        return await page.screenshot({ type: 'png', fullPage: true });
    } finally {
        await page.close();
    }
}

const dataUrl = (png: Uint8Array): string => `data:image/png;base64,${Buffer.from(png).toString('base64')}`;

const ICONS = {
    sidebar: '<svg viewBox="0 0 20 16"><rect x="1" y="1" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 1v14" stroke="currentColor" stroke-width="1.6"/></svg>',
    back: '<svg viewBox="0 0 12 18"><path d="M9 2 2 9l7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    forward: '<svg viewBox="0 0 12 18"><path d="m3 2 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    share: '<svg viewBox="0 0 16 20"><path d="M8 1v12M4 5l4-4 4 4M5 8H2v11h12V8h-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 16 16"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    tabs: '<svg viewBox="0 0 18 18"><rect x="1" y="4" width="13" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 1h10a3 3 0 0 1 3 3v10" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
};

/** Lays out the caption and a Safari-style window around the captured page. */
function composeHtml(scene: Scene, page: string, toolbarIcon: string, maybePopup: string | undefined): string {
    const popup = maybePopup === undefined ? '' : `<div class="popover"><div class="arrow"></div><img src="${maybePopup}"></div>`;
    return `<!doctype html><html><head><style>
        * { box-sizing: border-box; margin: 0; }
        body {
            width: ${CANVAS.width}px; height: ${CANVAS.height}px; overflow: hidden;
            font-family: -apple-system, system-ui, sans-serif; color: #1d1d1f;
            background: linear-gradient(160deg, #f5f7fb 0%, #dde5f0 100%);
            display: flex; flex-direction: column; align-items: center;
        }
        h1 { margin-top: 44px; font-size: 46px; font-weight: 700; letter-spacing: -0.02em; }
        p.subtitle { margin-top: 10px; font-size: 22px; color: #515154; }
        .window {
            position: relative; margin-top: 34px; width: ${VIEWPORT.width}px; border-radius: 12px; overflow: hidden;
            background: #fff; box-shadow: 0 0 0 0.5px rgba(0,0,0,0.25), 0 24px 60px rgba(30,45,70,0.28);
        }
        .toolbar {
            height: 52px; display: flex; align-items: center; gap: 18px; padding: 0 18px;
            background: #f6f6f6; border-bottom: 1px solid #d9d9d9; color: #6e6e73;
        }
        .lights { display: flex; gap: 8px; margin-right: 6px; }
        .lights span { width: 12px; height: 12px; border-radius: 50%; }
        .icon { display: block; height: 16px; }
        .icon svg { height: 100%; display: block; }
        .address {
            flex: 1; margin: 0 40px; height: 32px; border-radius: 8px; background: #e8e8ea;
            display: flex; align-items: center; justify-content: center; font-size: 14px; color: #3a3a3c;
        }
        /* The 38px icon at 2x, so it is never resampled. */
        .extension { width: 19px; height: 19px; }
        .page { display: block; width: ${VIEWPORT.width}px; height: ${VIEWPORT.height}px; }
        .popover {
            position: absolute; top: 60px; border-radius: 10px; background: #fff;
            box-shadow: 0 0 0 0.5px rgba(0,0,0,0.2), 0 16px 40px rgba(0,0,0,0.25);
        }
        .popover img { display: block; width: 420px; border-radius: 10px; }
        .arrow {
            position: absolute; top: -7px; width: 14px; height: 14px; background: #fff;
            transform: rotate(45deg); box-shadow: -0.5px -0.5px 0 0 rgba(0,0,0,0.2);
        }
    </style></head><body>
        <h1>${scene.title}</h1>
        <p class="subtitle">${scene.subtitle}</p>
        <div class="window">
            <div class="toolbar">
                <div class="lights"><span style="background:#ff5f57"></span><span style="background:#febc2e"></span><span style="background:#28c840"></span></div>
                <span class="icon">${ICONS.sidebar}</span>
                <span class="icon">${ICONS.back}</span>
                <span class="icon">${ICONS.forward}</span>
                <div class="address">${DISPLAYED_HOST}</div>
                <img class="extension" src="${toolbarIcon}">
                <span class="icon">${ICONS.share}</span>
                <span class="icon">${ICONS.plus}</span>
                <span class="icon">${ICONS.tabs}</span>
            </div>
            <img class="page" src="${page}">
            ${popup}
        </div>
        <script>
            // Center the popover under the extension's toolbar icon, keeping it inside the window.
            const popover = document.querySelector('.popover');
            if (popover) {
                const windowRect = document.querySelector('.window').getBoundingClientRect();
                const icon = document.querySelector('.extension').getBoundingClientRect();
                const iconCenter = icon.left + icon.width / 2 - windowRect.left;
                const left = Math.min(iconCenter - popover.offsetWidth / 2, windowRect.width - popover.offsetWidth - 8);
                popover.style.left = left + 'px';
                popover.querySelector('.arrow').style.left = (iconCenter - left - 7) + 'px';
            }
        </script>
    </body></html>`;
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
        const toolbarIcon = dataUrl(await readFile(new URL('src/icon_38.png', repoRoot)));
        await rm(outputDir, { recursive: true, force: true });
        await mkdir(outputDir, { recursive: true });
        for (const scene of SCENES) {
            const page = dataUrl(await captureScene(browser, extensionOrigin, server.origin, scene));
            const maybePopup = scene.withPopup ? dataUrl(await capturePopup(browser, extensionOrigin)) : undefined;
            const png = await compose(browser, composeHtml(scene, page, toolbarIcon, maybePopup));
            await writeFile(new URL(scene.fileName, outputDir), png);
            console.log(`Wrote store/app-store/screenshots/${scene.fileName}`);
        }
    } finally {
        await browser.close();
        await server.close();
    }
}

await main();
