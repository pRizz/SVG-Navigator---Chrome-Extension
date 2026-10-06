/**
 * Shared E2E plumbing: a local fixture server and helpers that launch Chrome or
 * Firefox with the built SVG Navigator extension installed.
 *
 * Environment overrides:
 *   E2E_BROWSERS     comma-separated subset of "chrome,firefox" (default: both)
 *   E2E_CHROME_EXT   unpacked extension dir to test in Chrome (default: .build/chrome)
 *   E2E_FIREFOX_EXT  unpacked extension dir to test in Firefox (default: .build/firefox)
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const fixturesDir = fileURLToPath(new URL('fixtures', import.meta.url));

const FIREFOX_EXTENSION_ID = 'svg-navigator@prizzventuresllc.com';
// Pinned so the extension's moz-extension:// origin is predictable across runs.
const FIREFOX_EXTENSION_UUID = '0b7c6f5e-5d0e-4c55-9a43-4f1e7a3c2d10';

export const BROWSERS = (process.env.E2E_BROWSERS ?? 'chrome,firefox')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

const CONTENT_TYPES = {
    '.svg': 'image/svg+xml',
    '.html': 'text/html; charset=utf-8',
};

// Served without a file extension to exercise content-based SVG detection.
const EXTENSIONLESS_ROUTES = { '/diagram': 'simple.svg' };

/**
 * Serves `test/e2e/fixtures` over HTTP on an ephemeral localhost port.
 * @returns {Promise<{ origin: string, close: () => Promise<void> }>}
 */
export async function startFixtureServer() {
    const server = createServer(async (request, response) => {
        const { pathname } = new URL(request.url, 'http://localhost');
        const fileName = EXTENSIONLESS_ROUTES[pathname] ?? path.basename(pathname);
        try {
            const body = await readFile(path.join(fixturesDir, fileName));
            response.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(fileName)] });
            response.end(body);
        } catch {
            response.writeHead(404);
            response.end();
        }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    return {
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
    };
}

function extensionDir(browserName) {
    const override = process.env[`E2E_${browserName.toUpperCase()}_EXT`];
    return path.resolve(repoRoot, override ?? path.join('.build', browserName));
}

/**
 * Launches a headless browser with the unpacked extension installed.
 * @param {'chrome' | 'firefox'} browserName
 * @returns {Promise<{ browser: import('puppeteer').Browser, extensionOrigin: string }>}
 */
export async function launchWithExtension(browserName) {
    const dir = extensionDir(browserName);
    if (browserName === 'chrome') {
        const browser = await puppeteer.launch({
            headless: true,
            pipe: true,
            enableExtensions: true,
            // GitHub's Ubuntu runners restrict the user namespaces Chrome's sandbox needs.
            args: process.env.CI ? ['--no-sandbox'] : [],
        });
        const extensionId = await browser.installExtension(dir);
        return { browser, extensionOrigin: `chrome-extension://${extensionId}` };
    }
    if (browserName === 'firefox') {
        const browser = await puppeteer.launch({
            browser: 'firefox',
            headless: true,
            // WebDriver BiDi otherwise refuses to open moz-extension:// pages (the options popup).
            args: ['--remote-allow-system-access'],
            extraPrefsFirefox: {
                'extensions.webextensions.uuids': JSON.stringify({ [FIREFOX_EXTENSION_ID]: FIREFOX_EXTENSION_UUID }),
            },
        });
        await browser.installExtension(dir);
        return { browser, extensionOrigin: `moz-extension://${FIREFOX_EXTENSION_UUID}` };
    }
    throw new Error(`Unsupported browser "${browserName}"; expected chrome or firefox`);
}

/** Waits until the content script has wrapped the SVG and attached every listener. */
export async function waitForNavigator(page) {
    await page.waitForSelector('html[data-svg-navigator="ready"]', { timeout: 10_000 });
}

/** Returns the root SVG's viewBox as numbers. */
export async function getViewBox(page) {
    const text = await page.$eval('svg', (svg) => svg.getAttribute('viewBox'));
    const [x, y, width, height] = text.trim().split(/[\s,]+/).map(Number);
    return { x, y, width, height };
}

/** Waits until the root SVG's viewBox differs from `previous`, then returns it. */
export async function waitForViewBoxChange(page, previous) {
    const previousText = [previous.x, previous.y, previous.width, previous.height].join(' ');
    await page.waitForFunction(
        (expected) => document.querySelector('svg').getAttribute('viewBox').trim().split(/[\s,]+/).map(Number).join(' ') !== expected,
        { timeout: 5_000 },
        previousText,
    );
    return getViewBox(page);
}

/**
 * Polls `predicate` in `page` until it returns truthy.
 *
 * Unlike `waitForFunction`, this retries when an evaluation itself fails: in Firefox
 * an evaluation that races the tab's switch into the extension process loses its
 * realm and errors out. The last such error is attached if the poll times out.
 */
async function pollInPage(page, predicate, arg, { timeoutMs, description }) {
    const deadline = Date.now() + timeoutMs;
    let maybeLastError;
    for (;;) {
        try {
            if (await page.evaluate(predicate, arg)) { return; }
        } catch (error) {
            maybeLastError = error;
        }
        if (Date.now() > deadline) {
            throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}`, { cause: maybeLastError });
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}

/**
 * Navigates `page` to one of the extension's own pages (e.g. the options popup).
 *
 * Firefox's WebDriver BiDi never reports navigation events for moz-extension://
 * documents, so Puppeteer's `goto()` can't settle there even though the page loads.
 * Instead, start the navigation and poll the document itself; a navigation that
 * really fails surfaces as a timeout from that poll.
 */
export async function openExtensionPage(page, url) {
    if (!url.startsWith('moz-extension:')) {
        await page.goto(url);
        return;
    }
    // Deliberately not awaited (see above). The handler keeps the eventual
    // timeout/detach rejection from becoming an unhandled rejection.
    page.goto(url).catch(() => undefined);
    await pollInPage(
        page,
        (expected) => location.href === expected && document.readyState === 'complete',
        url,
        { timeoutMs: 10_000, description: `${url} to load` },
    );
}

/**
 * Runs `fn` inside an extension page so it can reach `chrome.storage`.
 * Waits for the options page to finish seeding default settings first, so those
 * asynchronous writes can't clobber whatever `fn` stores.
 * @template T
 * @param {import('puppeteer').Browser} browser
 * @param {string} extensionOrigin
 * @param {() => T | Promise<T>} fn serialized and evaluated in the extension page
 * @returns {Promise<T>}
 */
export async function evaluateInExtension(browser, extensionOrigin, fn) {
    const page = await browser.newPage();
    try {
        await openExtensionPage(page, `${extensionOrigin}/options_custom/index.html`);
        await pollInPage(page, async () => {
            const stored = await chrome.storage.sync.get(null);
            return Object.keys(window.SVGNavigatorDefaultSettings).every((key) => key in stored);
        }, undefined, { timeoutMs: 5_000, description: 'the options page to store default settings' });
        return await page.evaluate(fn);
    } finally {
        await page.close();
    }
}
