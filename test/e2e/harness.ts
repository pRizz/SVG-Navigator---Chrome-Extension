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
import puppeteer, { type Browser, type ElementHandle, type EvaluateFunc, type Page } from 'puppeteer';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const fixturesDir = fileURLToPath(new URL('fixtures', import.meta.url));

const FIREFOX_EXTENSION_ID = 'svg-navigator@prizzventuresllc.com';
// Pinned so the extension's moz-extension:// origin is predictable across runs.
const FIREFOX_EXTENSION_UUID = '0b7c6f5e-5d0e-4c55-9a43-4f1e7a3c2d10';

export type BrowserName = 'chrome' | 'firefox';

export interface ViewBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Path of the options popup inside the extension. */
export const OPTIONS_PAGE_PATH = 'options/index.html';

export const BROWSERS: string[] = (process.env.E2E_BROWSERS ?? 'chrome,firefox')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

const CONTENT_TYPES: Record<string, string> = {
    '.svg': 'image/svg+xml',
    '.html': 'text/html; charset=utf-8',
};

// Paths served from another file, or with extra headers, to exercise edge cases.
const ROUTES: Record<string, { file: string, headers: Record<string, string> }> = {
    // No file extension: exercises content-based SVG detection.
    '/diagram': { file: 'simple.svg', headers: {} },
    // The strictest policy a page can send: the HUD must still be styled.
    '/csp.svg': { file: 'simple.svg', headers: { 'content-security-policy': 'default-src \'none\'' } },
};

/** Serves `dir` (by default `test/e2e/fixtures`) over HTTP on an ephemeral localhost port. */
export async function startFixtureServer(dir = fixturesDir): Promise<{ origin: string, close: () => Promise<void> }> {
    const server = createServer((request, response) => {
        const { pathname } = new URL(request.url ?? '/', 'http://localhost');
        const maybeRoute = ROUTES[pathname];
        const fileName = maybeRoute?.file ?? path.basename(decodeURIComponent(pathname));
        readFile(path.join(dir, fileName)).then(
            (body) => {
                response.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(fileName)], ...maybeRoute?.headers });
                response.end(body);
            },
            () => {
                response.writeHead(404);
                response.end();
            },
        );
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
        throw new Error(`Fixture server has no TCP address: ${address}`);
    }
    return {
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
    };
}

function extensionDir(browserName: BrowserName): string {
    const override = process.env[`E2E_${browserName.toUpperCase()}_EXT`];
    return path.resolve(repoRoot, override ?? path.join('.build', browserName));
}

/**
 * Launches a headless browser with the unpacked extension installed.
 * `chromeArgs` are extra Chrome command-line switches.
 */
export async function launchWithExtension(
    browserName: string,
    chromeArgs: string[] = [],
): Promise<{ browser: Browser, extensionOrigin: string }> {
    if (browserName !== 'chrome' && browserName !== 'firefox') {
        throw new Error(`Unsupported browser "${browserName}"; expected chrome or firefox`);
    }
    const dir = extensionDir(browserName);
    if (browserName === 'chrome') {
        const browser = await puppeteer.launch({
            headless: true,
            pipe: true,
            enableExtensions: true,
            // GitHub's Ubuntu runners restrict the user namespaces Chrome's sandbox needs.
            args: [...(process.env.CI ? ['--no-sandbox'] : []), ...chromeArgs],
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
    browserName satisfies never;
    throw new Error('unreachable');
}

/** Waits until the content script has wrapped the SVG and attached every listener. */
export async function waitForNavigator(page: Page): Promise<void> {
    await page.waitForSelector('html[data-svg-navigator="ready"]', { timeout: 10_000 });
}

/** Returns the root SVG's viewBox as numbers. */
export async function getViewBox(page: Page): Promise<ViewBox> {
    const text = await page.$eval('svg', (svg) => svg.getAttribute('viewBox'));
    const [x, y, width, height] = (text ?? '').trim().split(/[\s,]+/).map(Number);
    if (x === undefined || y === undefined || width === undefined || height === undefined) {
        throw new Error(`Malformed viewBox "${text}"`);
    }
    return { x, y, width, height };
}

/** Waits until the root SVG's viewBox differs from `previous`, then returns it. */
export async function waitForViewBoxChange(page: Page, previous: ViewBox): Promise<ViewBox> {
    const previousText = [previous.x, previous.y, previous.width, previous.height].join(' ');
    await page.waitForFunction(
        (expected) => (document.querySelector('svg')?.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number).join(' ') !== expected,
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
async function pollInPage<Params extends unknown[]>(
    page: Page,
    predicate: EvaluateFunc<Params>,
    { timeoutMs, description }: { timeoutMs: number, description: string },
    ...args: Params
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let maybeLastError: unknown;
    for (;;) {
        try {
            if (await page.evaluate(predicate, ...args)) { return; }
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
export async function openExtensionPage(page: Page, url: string): Promise<void> {
    if (!url.startsWith('moz-extension:')) {
        await page.goto(url);
        return;
    }
    // Deliberately not awaited (see above). The handler keeps the eventual
    // timeout/detach rejection from becoming an unhandled rejection.
    page.goto(url).catch(() => undefined);
    await pollInPage(
        page,
        (expected: string) => location.href === expected && document.readyState === 'complete',
        { timeoutMs: 10_000, description: `${url} to load` },
        url,
    );
}

/** Opens the options popup and waits until it shows the stored settings. */
export async function openOptionsPage(page: Page, extensionOrigin: string): Promise<void> {
    await openExtensionPage(page, `${extensionOrigin}/${OPTIONS_PAGE_PATH}`);
    await pollInPage(
        page,
        () => document.documentElement.dataset.optionsReady === 'true',
        { timeoutMs: 5_000, description: 'the options page to load settings' },
    );
}

/**
 * Clicks an element in one of the extension's own pages. Firefox's WebDriver BiDi
 * refuses real input on moz-extension:// pages ("browsing contexts in privileged
 * scope"), so this dispatches the click through the DOM in every browser.
 */
export async function clickInExtensionPage(page: Page, selector: string): Promise<void> {
    const found = await page.evaluate((target: string) => {
        const element = document.querySelector<HTMLElement>(target);
        element?.click();
        return element !== null;
    }, selector);
    if (!found) {
        throw new Error(`No element matches ${selector}`);
    }
}

/** Polls sync storage from `page` (an extension page) until `key` holds `expected`. */
export async function waitForStoredSetting(page: Page, key: string, expected: unknown): Promise<void> {
    await pollInPage(
        page,
        async (storageKey: string, value: unknown) => (await chrome.storage.sync.get(storageKey))[storageKey] === value,
        { timeoutMs: 5_000, description: `stored ${key} to become ${JSON.stringify(expected)}` },
        key,
        expected,
    );
}

/**
 * Runs `fn` inside an extension page so it can reach `chrome.storage`.
 * `fn` is serialized and evaluated in the page, so it can't close over test variables;
 * pass them through `args` instead.
 */
export async function evaluateInExtension<Params extends unknown[], Func extends EvaluateFunc<Params>>(
    browser: Browser,
    extensionOrigin: string,
    fn: Func,
    ...args: Params
): Promise<Awaited<ReturnType<Func>>> {
    const page = await browser.newPage();
    try {
        await openExtensionPage(page, `${extensionOrigin}/${OPTIONS_PAGE_PATH}`);
        return await page.evaluate(fn, ...args);
    } finally {
        await page.close();
    }
}

/** The HUD's shadow host tag; matches `HUD_HOST_TAG` in `src/js/hud/shadowHost.ts`. */
export const HUD_HOST = 'svg-navigator-hud';

/**
 * Finds `selector` inside the HUD's open shadow root, or returns null. Evaluated in
 * the page, which sees the content script's shadow root because it is open.
 */
export async function maybeHudElement(page: Page, selector: string): Promise<ElementHandle<Element> | null> {
    const handle = await page.evaluateHandle(
        (host: string, target: string) => document.querySelector(host)?.shadowRoot?.querySelector(target) ?? null,
        HUD_HOST,
        selector,
    );
    const maybeElement = handle.asElement();
    if (maybeElement === null) {
        await handle.dispose();
    }
    return maybeElement as ElementHandle<Element> | null;
}

export async function hudElement(page: Page, selector: string): Promise<ElementHandle<Element>> {
    const maybeElement = await maybeHudElement(page, selector);
    if (maybeElement === null) {
        throw new Error(`No HUD element matches ${selector}`);
    }
    return maybeElement;
}

export async function hudText(page: Page, selector: string): Promise<string | null> {
    return page.evaluate(
        (host: string, target: string) => document.querySelector(host)?.shadowRoot?.querySelector(target)?.textContent ?? null,
        HUD_HOST,
        selector,
    );
}

/** A computed style property of a HUD element, or null when the element is missing. */
export async function hudComputedStyle(page: Page, selector: string, property: string): Promise<string | null> {
    return page.evaluate(
        (host: string, target: string, name: string) => {
            const maybeElement = document.querySelector(host)?.shadowRoot?.querySelector(target);
            return maybeElement ? getComputedStyle(maybeElement).getPropertyValue(name) : null;
        },
        HUD_HOST,
        selector,
        property,
    );
}

/** Waits until a HUD element matching `selector` exists (or, with `present: false`, doesn't). */
export async function waitForHudElement(page: Page, selector: string, present: boolean): Promise<void> {
    await page.waitForFunction(
        (host: string, target: string, shouldExist: boolean) =>
            Boolean(document.querySelector(host)?.shadowRoot?.querySelector(target)) === shouldExist,
        { timeout: 5_000 },
        HUD_HOST,
        selector,
        present,
    );
}

/** Waits until a HUD element's `attribute` equals `expected`; null means the attribute is absent. */
export async function waitForHudAttribute(page: Page, selector: string, attribute: string, expected: string | null): Promise<void> {
    await page.waitForFunction(
        (host: string, target: string, name: string, value: string | null) =>
            document.querySelector(host)?.shadowRoot?.querySelector(target)?.getAttribute(name) === value,
        { timeout: 5_000 },
        HUD_HOST,
        selector,
        attribute,
        expected,
    );
}

export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
