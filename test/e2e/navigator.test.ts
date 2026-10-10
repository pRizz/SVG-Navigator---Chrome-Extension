/**
 * Cross-browser UI tests for navigation itself: drive the built extension with real
 * mouse and keyboard input and assert on what the user would see.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BROWSERS, getViewBox, waitForViewBoxChange } from './harness.ts';
import { useExtensionSuite } from './suite.ts';

for (const browserName of BROWSERS) {
    describe(browserName, () => {
        const suite = useExtensionSuite(browserName);

        test('wraps the SVG in an HTML page and mounts the HUD', async () => {
            // Act
            await suite.openSvg();

            // Assert
            assert.equal(await suite.page.$eval('svg', (svg) => svg.parentElement?.localName), 'body');
            assert.ok(await suite.page.$('svg-navigator-hud'), 'HUD should be present');
        });

        test('scrolling the wheel up zooms in', async () => {
            // Arrange
            await suite.openSvg();
            const before = await getViewBox(suite.page);
            await suite.page.mouse.move(400, 300);

            // Act
            await suite.page.mouse.wheel({ deltaY: -200 });

            // Assert
            const after = await waitForViewBoxChange(suite.page, before);
            assert.ok(after.width < before.width, `width ${after.width} should be < ${before.width}`);
        });

        test('dragging with the mouse pans without zooming', async () => {
            // Arrange
            await suite.openSvg();
            const before = await getViewBox(suite.page);

            // Act
            await suite.page.mouse.move(400, 300);
            await suite.page.mouse.down();
            await suite.page.mouse.move(300, 250, { steps: 5 });
            await suite.page.mouse.up();

            // Assert
            const after = await waitForViewBoxChange(suite.page, before);
            assert.ok(after.x > before.x, 'dragging left should move the view right');
            assert.ok(after.y > before.y, 'dragging up should move the view down');
            assert.equal(after.width, before.width);
            assert.equal(after.height, before.height);
        });

        test('dragging with Shift held pans like a plain drag, and Escape restores the view', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);

            // Act
            await suite.page.keyboard.down('Shift');
            await suite.page.mouse.move(400, 300);
            await suite.page.mouse.down();
            await suite.page.mouse.move(300, 250, { steps: 5 });
            await suite.page.mouse.up();
            await suite.page.keyboard.up('Shift');
            const panned = await waitForViewBoxChange(suite.page, original);
            await suite.page.keyboard.press('Escape');

            // Assert
            assert.ok(panned.x > original.x && panned.y > original.y, `expected a pan, got ${JSON.stringify(panned)}`);
            assert.equal(panned.width, original.width);
            assert.deepEqual(await waitForViewBoxChange(suite.page, panned), original);
        });

        test('holding Space while moving the mouse pans without zooming', async () => {
            // Arrange
            await suite.openSvg();
            const before = await getViewBox(suite.page);
            await suite.page.mouse.move(400, 300);

            // Act
            await suite.page.keyboard.down(' '); // Firefox's BiDi driver has no 'Space' key name
            await suite.page.mouse.move(300, 250, { steps: 5 });
            await suite.page.keyboard.up(' ');

            // Assert
            const after = await waitForViewBoxChange(suite.page, before);
            assert.ok(after.x > before.x, 'moving left should move the view right');
            assert.ok(after.y > before.y, 'moving up should move the view down');
            assert.equal(after.width, before.width);
        });

        test('dragging in Zoom box mode zooms in to the dragged area', async () => {
            // Arrange
            await suite.setSettings({ clickAndDragBehavior: 'zoomBox' });
            await suite.openSvg();
            const before = await getViewBox(suite.page);

            // Act
            await suite.page.mouse.move(200, 150);
            await suite.page.mouse.down();
            await suite.page.mouse.move(400, 300, { steps: 5 });
            await suite.page.mouse.up();

            // Assert
            const after = await waitForViewBoxChange(suite.page, before);
            assert.ok(after.width < before.width, `width ${after.width} should be < ${before.width}`);
        });

        test('Ctrl = zooms in and Ctrl 0 restores the original view', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);

            // Act
            await suite.page.keyboard.down('Control');
            await suite.page.keyboard.press('Equal');
            const zoomed = await waitForViewBoxChange(suite.page, original);
            await suite.page.keyboard.press('Digit0');
            await suite.page.keyboard.up('Control');

            // Assert
            assert.ok(zoomed.width < original.width, `width ${zoomed.width} should be < ${original.width}`);
            assert.deepEqual(await waitForViewBoxChange(suite.page, zoomed), original);
        });

        test('Ctrl - zooms out', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);

            // Act
            await suite.page.keyboard.down('Control');
            await suite.page.keyboard.press('Minus');
            await suite.page.keyboard.up('Control');

            // Assert
            const zoomed = await waitForViewBoxChange(suite.page, original);
            assert.ok(zoomed.width > original.width, `width ${zoomed.width} should be > ${original.width}`);
        });

        test('tapping Alt zooms out', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);

            // Act
            await suite.page.keyboard.press('Alt');

            // Assert
            const zoomed = await waitForViewBoxChange(suite.page, original);
            assert.ok(zoomed.width > original.width, `width ${zoomed.width} should be > ${original.width}`);
        });

        test('pressing Escape restores the original view', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);
            await suite.page.mouse.move(400, 300);
            await suite.page.mouse.wheel({ deltaY: -200 });
            const zoomed = await waitForViewBoxChange(suite.page, original);

            // Act
            await suite.page.keyboard.press('Escape');

            // Assert
            assert.deepEqual(await waitForViewBoxChange(suite.page, zoomed), original);
        });

        test('adds a viewBox to an SVG that lacks one', async () => {
            // Act
            await suite.openSvg('/no-viewbox.svg');

            // Assert
            const viewBox = await getViewBox(suite.page);
            assert.ok(viewBox.width > 0 && viewBox.height > 0, `unexpected viewBox ${JSON.stringify(viewBox)}`);
        });

        test('sizes the view of a percent-sized SVG without a viewBox to the window', async () => {
            // Act
            await suite.openSvg('/percent-size.svg');

            // Assert: 100% of the window, not 100 user units
            const viewBox = await getViewBox(suite.page);
            const windowWidth = await suite.page.evaluate(() => innerWidth);
            assert.equal(viewBox.width, windowWidth);
        });

        test('handles an SVG served from a URL without an .svg extension', async () => {
            // Act
            await suite.openSvg('/diagram');

            // Assert
            assert.ok(await suite.page.$('svg-navigator-hud'), 'HUD should be present');
        });

        test('leaves HTML pages with inline SVG untouched', async () => {
            // Arrange
            const markerTimeoutMs = 1_000;

            // Act
            await suite.page.goto(`${suite.fixtureOrigin()}/inline.html`);
            const maybeReady = await suite.page
                .waitForSelector('html[data-svg-navigator]', { timeout: markerTimeoutMs })
                .catch(() => null);

            // Assert
            assert.equal(maybeReady, null, 'extension should not activate on HTML pages');
            assert.equal(await suite.page.$('svg-navigator-hud'), null);
            assert.equal(await suite.page.$eval('svg', (svg) => svg.getAttribute('viewBox')), '0 0 100 100');
        });

        test('loads without page errors', async () => {
            // Act
            await suite.openSvg();

            // Assert
            assert.deepEqual(suite.pageErrors, []);
        });

        test('applies a background color change to an open SVG', async () => {
            // Arrange
            await suite.openSvg();

            // Act
            await suite.setSettings({ svgBackgroundColor: 'rgb(255, 0, 0)' });

            // Assert
            await suite.page.waitForFunction(() => document.body.style.backgroundColor === 'rgb(255, 0, 0)', { timeout: 5_000 });
        });
    });
}
