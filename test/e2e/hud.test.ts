/**
 * Cross-browser UI tests for the HUD: the control pill in its shadow root, how it
 * follows the view and the settings, and that pages and the HUD can't restyle each other.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    BROWSERS,
    HUD_HOST,
    delay,
    getViewBox,
    hudComputedStyle,
    hudElement,
    hudText,
    maybeHudElement,
    waitForHudAttribute,
    waitForHudElement,
    waitForViewBoxChange,
} from './harness.ts';
import { useExtensionSuite } from './suite.ts';

/** Long enough for a stray pan or zoom to have landed. */
const SETTLE_MS = 300;

for (const browserName of BROWSERS) {
    describe(browserName, () => {
        const suite = useExtensionSuite(browserName);

        test('shows the pill over a wrapped SVG', async () => {
            // Act
            await suite.openSvg();

            // Assert
            assert.ok(await maybeHudElement(suite.page, '.pill'), 'pill should be present');
        });

        test('+ zooms in and the readout follows', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);

            // Act
            await (await hudElement(suite.page, '.zoom-in')).click();

            // Assert
            const zoomed = await waitForViewBoxChange(suite.page, original);
            assert.ok(zoomed.width < original.width, 'plus should zoom in');
            assert.equal(await hudText(suite.page, '.zoom-label'), '125%');
        });

        test('Space after clicking a HUD button pans instead of pressing the button again', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);
            await (await hudElement(suite.page, '.zoom-in')).click();
            const zoomed = await waitForViewBoxChange(suite.page, original);
            await suite.page.mouse.move(400, 300);

            // Act
            await suite.page.keyboard.down(' '); // Firefox's BiDi driver has no 'Space' key name
            await suite.page.mouse.move(300, 250, { steps: 5 });
            await suite.page.keyboard.up(' ');

            // Assert
            await delay(SETTLE_MS);
            const panned = await getViewBox(suite.page);
            assert.ok(panned.x > zoomed.x, 'moving left should move the view right');
            assert.ok(panned.y > zoomed.y, 'moving up should move the view down');
            assert.equal(panned.width, zoomed.width, 'Space must not re-press the zoom button');
        });

        test('clicking the readout restores the original view', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);
            await (await hudElement(suite.page, '.zoom-in')).click();
            const zoomed = await waitForViewBoxChange(suite.page, original);

            // Act
            await (await hudElement(suite.page, '.zoom-label')).click();

            // Assert
            assert.deepEqual(await waitForViewBoxChange(suite.page, zoomed), original);
            assert.equal(await hudText(suite.page, '.zoom-label'), '100%');
        });

        test('scrolling over the pill leaves the view alone', async () => {
            // Arrange
            await suite.openSvg();
            const before = await getViewBox(suite.page);
            const box = await (await hudElement(suite.page, '.pill')).boundingBox();
            assert.ok(box, 'pill should have a box');
            await suite.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

            // Act
            await suite.page.mouse.wheel({ deltaY: -200 });
            await delay(SETTLE_MS);

            // Assert
            assert.deepEqual(await getViewBox(suite.page), before);
        });

        test('Space on a focused HUD button does not start a pan', async () => {
            // Arrange: the readout resets, which changes nothing at the original view.
            await suite.openSvg();
            const before = await getViewBox(suite.page);
            await (await hudElement(suite.page, '.zoom-label')).focus();
            await suite.page.mouse.move(400, 300);

            // Act
            await suite.page.keyboard.down(' '); // Firefox's BiDi driver has no 'Space' key name
            await suite.page.mouse.move(300, 250, { steps: 5 });
            await suite.page.keyboard.up(' ');
            await delay(SETTLE_MS);

            // Assert
            assert.deepEqual(await getViewBox(suite.page), before);
        });

        test('respects the toolbarEnabled setting', async () => {
            // Arrange
            await suite.setSettings({ toolbarEnabled: false });

            // Act
            await suite.openSvg();

            // Assert
            assert.equal(await maybeHudElement(suite.page, '.pill'), null);
        });

        test('removes the pill live when the toolbar is turned off', async () => {
            // Arrange
            await suite.openSvg();

            // Act
            await suite.setSettings({ toolbarEnabled: false });

            // Assert
            await waitForHudElement(suite.page, '.pill', false);
        });

        test('moves the pill live when the position changes, upright on a side edge', async () => {
            // Arrange
            await suite.openSvg();

            // Act
            await suite.setSettings({ toolbarPosition: 'left' });

            // Assert
            await waitForHudAttribute(suite.page, '.dock', 'data-position', 'left');
            const box = await (await hudElement(suite.page, '.pill')).boundingBox();
            assert.ok(box, 'pill should have a box');
            assert.ok(box.x < 100, `pill should hug the left edge, got x=${box.x}`);
            assert.ok(box.height > box.width, 'pill should be vertical on a side edge');
        });

        test('is styled under a strict Content-Security-Policy', async () => {
            // Act
            await suite.openSvg('/csp.svg');

            // Assert
            assert.equal(await hudComputedStyle(suite.page, '.dock', 'position'), 'fixed');
            // A constructed sheet no page policy can block, not the `<style>` fallback.
            const delivery = await suite.page.evaluate((host: string) => {
                const maybeRoot = document.querySelector(host)?.shadowRoot;
                return { adoptedSheets: maybeRoot?.adoptedStyleSheets.length, styleElements: maybeRoot?.querySelectorAll('style').length };
            }, HUD_HOST);
            assert.deepEqual(delivery, { adoptedSheets: 1, styleElements: 0 });
        });

        test('cannot be hidden by the SVG\'s own stylesheet', async () => {
            // Act
            await suite.openSvg('/hostile-style.svg');

            // Assert
            const box = await (await hudElement(suite.page, '.pill')).boundingBox();
            assert.ok(box && box.width > 0 && box.height > 0, 'pill should still be laid out');
            assert.equal(await suite.page.$eval(HUD_HOST, (host) => getComputedStyle(host).display), 'block');
            assert.notEqual(await hudComputedStyle(suite.page, '.zoom-label', 'font-size'), '40px', 'page font rules should not reach the HUD text');
        });

        test('fades after a quiet spell and wakes on mouse movement', async () => {
            // Arrange
            await suite.openSvg();

            // Act
            await waitForHudAttribute(suite.page, '.dock', 'data-hidden', '');
            await suite.page.mouse.move(200, 200);

            // Assert
            await waitForHudAttribute(suite.page, '.dock', 'data-hidden', null);
        });

        test('stays visible with auto-hide off', async () => {
            // Arrange
            await suite.setSettings({ toolbarAutoHide: false });
            await suite.openSvg();

            // Act
            await delay(2_500);

            // Assert
            assert.equal(await suite.page.evaluate(
                (host: string) => document.querySelector(host)?.shadowRoot?.querySelector('.dock')?.hasAttribute('data-hidden'),
                HUD_HOST,
            ), false);
        });

        test('leaves the styling of HTML pages alone', async () => {
            // Act
            await suite.page.goto(`${suite.fixtureOrigin()}/styled-page.html`);

            // Assert
            assert.equal(await suite.page.$eval('.toolbarcontainer', (element) => getComputedStyle(element).opacity), '1');
        });

        test('the background button switches to a checkerboard', async () => {
            // Arrange
            await suite.openSvg();

            // Act
            await (await hudElement(suite.page, '.background')).click();

            // Assert
            await suite.page.waitForFunction(
                () => getComputedStyle(document.body).backgroundImage.includes('conic-gradient'),
                { timeout: 5_000 },
            );
        });

        test('a background color change mid-cycle shows the new color', async () => {
            // Arrange
            await suite.openSvg();
            await (await hudElement(suite.page, '.background')).click();

            // Act
            await suite.setSettings({ svgBackgroundColor: 'rgb(255, 0, 0)' });

            // Assert
            await suite.page.waitForFunction(() => document.body.style.backgroundColor === 'rgb(255, 0, 0)', { timeout: 5_000 });
        });

        test('? lists the shortcuts, and Escape closes the list without resetting the view', async () => {
            // Arrange
            await suite.openSvg();
            await suite.page.mouse.move(400, 300);
            const original = await getViewBox(suite.page);
            await suite.page.mouse.wheel({ deltaY: -200 });
            const zoomed = await waitForViewBoxChange(suite.page, original);
            await (await hudElement(suite.page, '.shortcuts')).click();
            await waitForHudAttribute(suite.page, '.popover', 'hidden', null);
            assert.match(await hudText(suite.page, '.popover') ?? '', /hold Space and move/i);

            // Act
            await suite.page.keyboard.press('Escape');

            // Assert
            await waitForHudAttribute(suite.page, '.popover', 'hidden', '');
            await delay(SETTLE_MS);
            assert.deepEqual(await getViewBox(suite.page), zoomed);
        });

        test('Space after closing the shortcuts with Escape pans instead of reopening them', async () => {
            // Arrange
            await suite.openSvg();
            const before = await getViewBox(suite.page);
            await (await hudElement(suite.page, '.shortcuts')).click();
            await waitForHudAttribute(suite.page, '.popover', 'hidden', null);
            await suite.page.keyboard.press('Escape');
            await waitForHudAttribute(suite.page, '.popover', 'hidden', '');
            await suite.page.mouse.move(400, 300);

            // Act
            await suite.page.keyboard.down(' '); // Firefox's BiDi driver has no 'Space' key name
            await suite.page.mouse.move(300, 250, { steps: 5 });
            await suite.page.keyboard.up(' ');

            // Assert
            const after = await waitForViewBoxChange(suite.page, before);
            assert.ok(after.x > before.x, 'moving left should move the view right');
            const popover = await hudElement(suite.page, '.popover');
            assert.equal(await popover.evaluate((element) => element.hasAttribute('hidden')), true, 'Space must not reopen the shortcuts');
        });

        test('the debug card reports a viewBox derived from the size, and the authored width', async () => {
            // Arrange
            await suite.setSettings({ showDebugInfo: true });

            // Act
            await suite.openSvg('/no-viewbox.svg');

            // Assert
            const text = await hudText(suite.page, '.debug-body') ?? '';
            assert.match(text, /derived from size/);
            assert.match(text, /Authored width\s*400/);
        });

        test('the debug card minimizes to a chip and expands again', async () => {
            // Arrange
            await suite.setSettings({ showDebugInfo: true });
            await suite.openSvg();

            // Act
            await (await hudElement(suite.page, '.debug-minimize')).click();
            await waitForHudAttribute(suite.page, '.debug', 'hidden', '');
            await (await hudElement(suite.page, '.debug-chip')).click();

            // Assert
            await waitForHudAttribute(suite.page, '.debug', 'hidden', null);
            await waitForHudAttribute(suite.page, '.debug-chip', 'hidden', '');
        });

        // Firefox's WebDriver BiDi offers no clipboard permission override, so only Chrome can read it back.
        if (browserName === 'chrome') {
            test('Copy puts the debug info on the clipboard', async () => {
                // Arrange
                await suite.launched().defaultBrowserContext().overridePermissions(suite.fixtureOrigin(), ['clipboard-read', 'clipboard-sanitized-write']);
                await suite.setSettings({ showDebugInfo: true });
                await suite.openSvg();
                await suite.page.bringToFront();

                // Act
                await (await hudElement(suite.page, '.debug-copy')).click();
                await waitForHudAttribute(suite.page, '.debug-copy', 'aria-label', 'Copied');

                // Assert
                const copied = await suite.page.evaluate(() => navigator.clipboard.readText());
                assert.match(copied, /^View\nX: /);
                assert.match(copied, /\n\nBuild\nVersion: /);
            });
        }
    });
}
