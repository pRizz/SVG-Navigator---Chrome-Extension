/**
 * Cross-browser UI tests: drive the built extension with real mouse and keyboard
 * input and assert on what the user would see (the SVG viewBox and the toolbar).
 */

import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    BROWSERS,
    evaluateInExtension,
    getViewBox,
    launchWithExtension,
    openExtensionPage,
    startFixtureServer,
    waitForNavigator,
    waitForViewBoxChange,
} from './harness.mjs';

const screenshotDir = fileURLToPath(new URL('../../test-results/e2e-screenshots/', import.meta.url));

for (const browserName of BROWSERS) {
    describe(browserName, () => {
        let server;
        let browser;
        let extensionOrigin;
        let page;
        let pageErrors;

        before(async () => {
            server = await startFixtureServer();
            ({ browser, extensionOrigin } = await launchWithExtension(browserName));
        });

        after(async () => {
            await browser?.close();
            await server?.close();
        });

        beforeEach(async () => {
            page = await browser.newPage();
            pageErrors = [];
            page.on('pageerror', (error) => pageErrors.push(error.message));
        });

        afterEach(async (t) => {
            if (!t.passed) {
                await mkdir(screenshotDir, { recursive: true });
                const name = `${browserName}-${t.name}`.replace(/[^a-z0-9-]+/gi, '_');
                await page.screenshot({ path: path.join(screenshotDir, `${name}.png`) });
            }
            await page.close();
            await evaluateInExtension(browser, extensionOrigin, () => chrome.storage.sync.clear());
        });

        async function openSvg(fixturePath = '/simple.svg') {
            await page.goto(`${server.origin}${fixturePath}`);
            await waitForNavigator(page);
        }

        test('wraps the SVG in an HTML page and shows the toolbar', async () => {
            // Act
            await openSvg();

            // Assert
            assert.equal(await page.$eval('svg', (svg) => svg.parentElement.localName), 'body');
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
            await page.goto(`${server.origin}/inline.html`);
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
            await openExtensionPage(page, `${extensionOrigin}/options_custom/index.html`);
            await page.waitForFunction(() => document.body.innerText.includes('Scroll sensitivity'), { timeout: 5_000 });

            // Assert
            const text = await page.$eval('body', (body) => body.innerText);
            assert.match(text, /Click and drag/);
            assert.match(text, /Background Color/);
            assert.deepEqual(pageErrors, []);
        });

        test('respects the toolbarEnabled setting', async () => {
            // Arrange
            await evaluateInExtension(browser, extensionOrigin, () => chrome.storage.sync.set({ toolbarEnabled: false }));

            // Act
            await openSvg();

            // Assert
            assert.equal(await page.$('.toolbarcontainer'), null);
        });
    });
}
