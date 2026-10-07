/**
 * Cross-browser UI tests: drive the built extension with real mouse and keyboard
 * input and assert on what the user would see (the SVG viewBox and the toolbar).
 */

import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'puppeteer';
import {
    BROWSERS,
    clickInExtensionPage,
    evaluateInExtension,
    getViewBox,
    launchWithExtension,
    openOptionsPage,
    startFixtureServer,
    waitForNavigator,
    waitForStoredSetting,
    waitForViewBoxChange,
} from './harness.ts';

const screenshotDir = fileURLToPath(new URL('../../test-results/e2e-screenshots/', import.meta.url));

for (const browserName of BROWSERS) {
    describe(browserName, () => {
        let server: Awaited<ReturnType<typeof startFixtureServer>> | undefined;
        let browser: Browser | undefined;
        let extensionOrigin: string;
        let page: Page;
        let pageErrors: string[];

        before(async () => {
            server = await startFixtureServer();
            ({ browser, extensionOrigin } = await launchWithExtension(browserName));
        });

        after(async () => {
            await browser?.close();
            await server?.close();
        });

        /** The launched browser; only valid inside tests and per-test hooks. */
        function launched(): Browser {
            assert.ok(browser, `${browserName} failed to launch`);
            return browser;
        }

        function fixtureOrigin(): string {
            assert.ok(server, 'fixture server failed to start');
            return server.origin;
        }

        beforeEach(async () => {
            page = await launched().newPage();
            pageErrors = [];
            page.on('pageerror', (error) => pageErrors.push(error instanceof Error ? error.message : String(error)));
        });

        afterEach(async (t) => {
            // `passed` exists at runtime (Bun's node:test, Node >= 20.12) but is missing from @types/node 22.
            if (!('passed' in t && t.passed === true)) {
                await mkdir(screenshotDir, { recursive: true });
                const name = `${browserName}-${t.name}`.replace(/[^a-z0-9-]+/gi, '_');
                await page.screenshot({ path: path.join(screenshotDir, `${name}.png`) });
            }
            await page.close();
            await evaluateInExtension(launched(), extensionOrigin, () => chrome.storage.sync.clear());
        });

        async function openSvg(fixturePath = '/simple.svg'): Promise<void> {
            await page.goto(`${fixtureOrigin()}${fixturePath}`);
            await waitForNavigator(page);
        }

        test('wraps the SVG in an HTML page and shows the toolbar', async () => {
            // Act
            await openSvg();

            // Assert
            assert.equal(await page.$eval('svg', (svg) => svg.parentElement?.localName), 'body');
            assert.ok(await page.$('.toolbarcontainer'), 'toolbar should be present');
        });

        test('scrolling the wheel up zooms in', async () => {
            // Arrange
            await openSvg();
            const before = await getViewBox(page);
            await page.mouse.move(400, 300);

            // Act
            await page.mouse.wheel({ deltaY: -200 });

            // Assert
            const after = await waitForViewBoxChange(page, before);
            assert.ok(after.width < before.width, `width ${after.width} should be < ${before.width}`);
        });

        test('dragging with the mouse pans without zooming', async () => {
            // Arrange
            await openSvg();
            const before = await getViewBox(page);

            // Act
            await page.mouse.move(400, 300);
            await page.mouse.down();
            await page.mouse.move(300, 250, { steps: 5 });
            await page.mouse.up();

            // Assert
            const after = await waitForViewBoxChange(page, before);
            assert.ok(after.x > before.x, 'dragging left should move the view right');
            assert.ok(after.y > before.y, 'dragging up should move the view down');
            assert.equal(after.width, before.width);
            assert.equal(after.height, before.height);
        });

        test('holding Space while moving the mouse pans without zooming', async () => {
            // Arrange
            await openSvg();
            const before = await getViewBox(page);
            await page.mouse.move(400, 300);

            // Act
            await page.keyboard.down(' '); // Firefox's BiDi driver has no 'Space' key name
            await page.mouse.move(300, 250, { steps: 5 });
            await page.keyboard.up(' ');

            // Assert
            const after = await waitForViewBoxChange(page, before);
            assert.ok(after.x > before.x, 'moving left should move the view right');
            assert.ok(after.y > before.y, 'moving up should move the view down');
            assert.equal(after.width, before.width);
        });

        test('dragging in Zoom box mode zooms in to the dragged area', async () => {
            // Arrange
            await evaluateInExtension(launched(), extensionOrigin, () => chrome.storage.sync.set({ clickAndDragBehavior: 'zoomBox' }));
            await openSvg();
            const before = await getViewBox(page);

            // Act
            await page.mouse.move(200, 150);
            await page.mouse.down();
            await page.mouse.move(400, 300, { steps: 5 });
            await page.mouse.up();

            // Assert
            const after = await waitForViewBoxChange(page, before);
            assert.ok(after.width < before.width, `width ${after.width} should be < ${before.width}`);
        });

        test('pressing Escape restores the original view', async () => {
            // Arrange
            await openSvg();
            const original = await getViewBox(page);
            await page.mouse.move(400, 300);
            await page.mouse.wheel({ deltaY: -200 });
            const zoomed = await waitForViewBoxChange(page, original);

            // Act
            await page.keyboard.press('Escape');

            // Assert
            assert.deepEqual(await waitForViewBoxChange(page, zoomed), original);
        });

        test('toolbar + zooms in and Reset restores the original view', async () => {
            // Arrange
            await openSvg();
            const original = await getViewBox(page);

            // Act
            await page.click('.toolbar > .toolbarbutton:nth-child(1)');
            const zoomed = await waitForViewBoxChange(page, original);
            await page.click('.toolbar > .toolbarbutton:nth-child(3)');
            const reset = await waitForViewBoxChange(page, zoomed);

            // Assert
            assert.ok(zoomed.width < original.width, 'plus button should zoom in');
            assert.deepEqual(reset, original);
        });

        test('adds a viewBox to an SVG that lacks one', async () => {
            // Act
            await openSvg('/no-viewbox.svg');

            // Assert
            const viewBox = await getViewBox(page);
            assert.ok(viewBox.width > 0 && viewBox.height > 0, `unexpected viewBox ${JSON.stringify(viewBox)}`);
        });

        test('handles an SVG served from a URL without an .svg extension', async () => {
            // Act
            await openSvg('/diagram');

            // Assert
            assert.ok(await page.$('.toolbarcontainer'), 'toolbar should be present');
        });

        test('leaves HTML pages with inline SVG untouched', async () => {
            // Arrange
            const markerTimeoutMs = 1_000;

            // Act
            await page.goto(`${fixtureOrigin()}/inline.html`);
            const maybeReady = await page
                .waitForSelector('html[data-svg-navigator]', { timeout: markerTimeoutMs })
                .catch(() => null);

            // Assert
            assert.equal(maybeReady, null, 'extension should not activate on HTML pages');
            assert.equal(await page.$('.toolbarcontainer'), null);
            assert.equal(await page.$eval('svg', (svg) => svg.getAttribute('viewBox')), '0 0 100 100');
        });

        test('loads without page errors', async () => {
            // Act
            await openSvg();

            // Assert
            assert.deepEqual(pageErrors, []);
        });

        test('options popup renders its settings', async () => {
            // Act
            await openOptionsPage(page, extensionOrigin);

            // Assert
            const text = await page.$eval('body', (body) => (body as HTMLElement).innerText);
            assert.match(text, /Click and drag/);
            assert.match(text, /Scroll sensitivity/);
            assert.match(text, /Background color/);
            assert.deepEqual(pageErrors, []);
        });

        test('options popup footer shows the version, commit, and build time', async () => {
            // Act
            await openOptionsPage(page, extensionOrigin);

            // Assert
            const text = await page.$eval('#versionInfo', (footer) => footer.textContent);
            assert.match(text, /^Version [\d.]+ · Commit ([0-9a-f]{7}|Unavailable) · Built \d{4}-\d\d-\d\d \d\d:\d\d UTC$/);
        });

        test('options popup footer links to the source in a new tab', async () => {
            // Act
            await openOptionsPage(page, extensionOrigin);

            // Assert
            const link = await page.$eval('.footer-links a[href^="https://github.com/"]', (anchor) => ({ target: anchor.target, rel: anchor.rel }));
            assert.deepEqual(link, { target: '_blank', rel: 'noopener noreferrer' });
        });

        test('options popup shows the stored settings', async () => {
            // Arrange
            await evaluateInExtension(launched(), extensionOrigin, () => chrome.storage.sync.set({
                clickAndDragBehavior: 'zoomBox',
                scrollSensitivity: 3.5,
                toolbarEnabled: false,
                svgBackgroundColor: 'black',
            }));

            // Act
            await openOptionsPage(page, extensionOrigin);

            // Assert
            const shown = await page.evaluate(() => ({
                clickAndDrag: document.querySelector<HTMLInputElement>('input[name="clickAndDragBehavior"]:checked')?.value,
                sensitivity: document.querySelector<HTMLInputElement>('#scrollSensitivity')?.value,
                toolbarEnabled: document.querySelector<HTMLInputElement>('#toolbarEnabled')?.checked,
                toolbarAutoHide: document.querySelector<HTMLInputElement>('#toolbarAutoHide')?.checked,
                toolbarAutoHideDisabled: document.querySelector<HTMLInputElement>('#toolbarAutoHide')?.disabled,
                background: document.querySelector<HTMLInputElement>('#svgBackgroundColor')?.value,
            }));
            assert.deepEqual(shown, {
                clickAndDrag: 'zoomBox',
                sensitivity: '3.5',
                toolbarEnabled: false,
                toolbarAutoHide: true,
                toolbarAutoHideDisabled: true,
                background: 'black',
            });
        });

        test('options popup saves a toggled setting', async () => {
            // Arrange
            await openOptionsPage(page, extensionOrigin);

            // Act
            await clickInExtensionPage(page, '#toolbarEnabled');

            // Assert
            await waitForStoredSetting(page, 'toolbarEnabled', false);
        });

        test('options popup saves a typed background color even when closed right away', async () => {
            // Arrange
            await openOptionsPage(page, extensionOrigin);

            // Act: type, then close the popup before the save delay elapses.
            await page.evaluate(() => {
                const input = document.querySelector<HTMLInputElement>('#svgBackgroundColor');
                if (!input) { throw new Error('missing #svgBackgroundColor'); }
                input.value = 'black';
                input.dispatchEvent(new Event('input'));
            });
            await page.close();
            page = await launched().newPage();

            // Assert
            await openOptionsPage(page, extensionOrigin);
            await waitForStoredSetting(page, 'svgBackgroundColor', 'black');
        });

        test('options popup saves the clicked color preset', async () => {
            // Arrange
            await openOptionsPage(page, extensionOrigin);

            // Act
            await clickInExtensionPage(page, '.preset[data-color="black"]');

            // Assert
            await waitForStoredSetting(page, 'svgBackgroundColor', 'black');
            assert.equal(await page.$eval('#svgBackgroundColor', (input) => (input as HTMLInputElement).value), 'black');
        });

        test('options popup resets every setting after a confirming second click', async () => {
            // Arrange
            await evaluateInExtension(launched(), extensionOrigin, () => chrome.storage.sync.set({
                scrollSensitivity: 2,
                toolbarEnabled: false,
                svgBackgroundColor: 'black',
            }));
            await openOptionsPage(page, extensionOrigin);

            // Act
            await clickInExtensionPage(page, '#resetAll');
            await clickInExtensionPage(page, '#resetAll');

            // Assert
            await waitForStoredSetting(page, 'scrollSensitivity', 7);
            await waitForStoredSetting(page, 'toolbarEnabled', true);
            await waitForStoredSetting(page, 'svgBackgroundColor', 'white');
            assert.equal(await page.$eval('#scrollSensitivity', (input) => (input as HTMLInputElement).value), '7');
        });

        test('options popup does not reset on a single click', async () => {
            // Arrange
            await evaluateInExtension(launched(), extensionOrigin, () => chrome.storage.sync.set({ scrollSensitivity: 2 }));
            await openOptionsPage(page, extensionOrigin);

            // Act
            await clickInExtensionPage(page, '#resetAll');

            // Assert
            await waitForStoredSetting(page, 'scrollSensitivity', 2);
            assert.match(await page.$eval('#resetAll', (button) => button.textContent ?? ''), /Click again/);
        });

        test('applies a background color change to an open SVG', async () => {
            // Arrange
            await openSvg();

            // Act
            await evaluateInExtension(launched(), extensionOrigin, () => chrome.storage.sync.set({ svgBackgroundColor: 'rgb(255, 0, 0)' }));

            // Assert
            await page.waitForFunction(() => document.body.style.backgroundColor === 'rgb(255, 0, 0)', { timeout: 5_000 });
        });

        test('respects the toolbarEnabled setting', async () => {
            // Arrange
            await evaluateInExtension(launched(), extensionOrigin, () => chrome.storage.sync.set({ toolbarEnabled: false }));

            // Act
            await openSvg();

            // Assert
            assert.equal(await page.$('.toolbarcontainer'), null);
        });
    });
}
