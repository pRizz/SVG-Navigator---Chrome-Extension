/**
 * Cross-browser UI tests for navigation itself: drive the built extension with real
 * mouse and keyboard input and assert on what the user would see.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BROWSERS, HUD_HOST, delay, evaluateInExtension, getViewBox, waitForNavigator, waitForViewBoxChange } from './harness.ts';
import { pageOffKey } from '../../src/shared/pageSwitch.ts';

/** Longer than a glide, so the view has come to rest. */
const GLIDE_SETTLE_MS = 800;
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

        test('a trackpad pinch (Ctrl + wheel) zooms the drawing and is consumed, so the page does not zoom', async () => {
            // Arrange
            await suite.openSvg();
            const before = await getViewBox(suite.page);
            await suite.page.evaluate(() => {
                window.addEventListener('wheel', (event) => {
                    document.documentElement.dataset.lastWheelConsumed = String(event.defaultPrevented);
                });
            });
            await suite.page.mouse.move(400, 300);

            // Act
            await suite.page.keyboard.down('Control');
            await suite.page.mouse.wheel({ deltaY: -20 });
            await suite.page.keyboard.up('Control');

            // Assert
            const after = await waitForViewBoxChange(suite.page, before);
            assert.ok(after.width < before.width, `width ${after.width} should be < ${before.width}`);
            assert.equal(await suite.page.evaluate(() => document.documentElement.dataset.lastWheelConsumed), 'true');
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

        /** The drawing's user-space point under client point (x, y), as the page itself computes it. */
        async function svgPointAt(x: number, y: number): Promise<{ x: number, y: number }> {
            return suite.page.evaluate((clientX: number, clientY: number) => {
                const svg = document.querySelector('svg');
                const maybeMatrix = svg?.getScreenCTM();
                if (!svg || !maybeMatrix) { throw new Error('no rendered <svg>'); }
                const point = new DOMPoint(clientX, clientY).matrixTransform(maybeMatrix.inverse());
                return { x: point.x, y: point.y };
            }, x, y);
        }

        test('double-clicking zooms in 2× and keeps the point under the cursor', async () => {
            // Arrange
            await suite.openSvg();
            const before = await getViewBox(suite.page);
            const pointBefore = await svgPointAt(200, 150);

            // Act
            await suite.page.mouse.click(200, 150, { count: 2 });

            // Assert
            const after = await waitForViewBoxChange(suite.page, before);
            const pointAfter = await svgPointAt(200, 150);
            assert.ok(Math.abs(after.width - before.width / 2) < 1e-6, `width ${after.width} should be ${before.width / 2}`);
            // Firefox on Linux computes screen transforms in single precision (float32), so
            // allow a hundredth of a pixel rather than an exact match.
            const hundredthOfAPixel = (0.01 * after.width) / await suite.page.evaluate(() => innerWidth);
            assert.ok(Math.abs(pointAfter.x - pointBefore.x) < hundredthOfAPixel && Math.abs(pointAfter.y - pointBefore.y) < hundredthOfAPixel,
                `point moved from ${JSON.stringify(pointBefore)} to ${JSON.stringify(pointAfter)}`);
        });

        test('Shift + double-click zooms out 2×', async () => {
            // Arrange
            await suite.openSvg();
            const before = await getViewBox(suite.page);

            // Act
            await suite.page.keyboard.down('Shift');
            await suite.page.mouse.click(400, 300, { count: 2 });
            await suite.page.keyboard.up('Shift');

            // Assert
            const after = await waitForViewBoxChange(suite.page, before);
            assert.ok(Math.abs(after.width - before.width * 2) < 1e-6, `width ${after.width} should be ${before.width * 2}`);
        });

        test('double-clicking zooms in Zoom box mode too', async () => {
            // Arrange
            await suite.setSettings({ clickAndDragBehavior: 'zoomBox' });
            await suite.openSvg();
            const before = await getViewBox(suite.page);

            // Act
            await suite.page.mouse.click(400, 300, { count: 2 });

            // Assert
            const after = await waitForViewBoxChange(suite.page, before);
            assert.ok(Math.abs(after.width - before.width / 2) < 1e-6, `width ${after.width} should be ${before.width / 2}`);
        });

        test('a double-click right after a drag does not zoom', async () => {
            // Arrange: pan, then double-click straight away, while the pan still glides
            await suite.openSvg();
            const original = await getViewBox(suite.page);
            await suite.page.mouse.move(400, 300);
            await suite.page.mouse.down();
            await suite.page.mouse.move(300, 250, { steps: 5 });
            await suite.page.mouse.up();

            // Act
            await suite.page.mouse.click(300, 250, { count: 2 });
            await waitForViewBoxChange(suite.page, original);
            await delay(300);

            // Assert: pans and glides never change the width; a zoom would
            assert.equal((await getViewBox(suite.page)).width, original.width);
        });

        /**
         * Drags from (400, 300) to (300, 250) and releases, after `pauseMs` of stillness
         * if given; returns the views before, at release (only when paused), and settled.
         */
        async function dragAndRelease({ pauseMs }: { pauseMs: number }): Promise<{ before: { x: number }, maybeReleased: { x: number } | null, settled: { x: number } }> {
            const before = await getViewBox(suite.page);
            await suite.page.mouse.move(400, 300);
            await suite.page.mouse.down();
            await suite.page.mouse.move(300, 250, { steps: 5 });
            // Reading the view takes a round trip, which on a slow machine can outlast the
            // 50 ms after which a pointer counts as stopped, so only a paused drag reads it.
            let maybeReleased: { x: number } | null = null;
            if (pauseMs > 0) {
                await delay(pauseMs);
                maybeReleased = await getViewBox(suite.page);
            }
            await suite.page.mouse.up();
            await waitForViewBoxChange(suite.page, before);
            await delay(GLIDE_SETTLE_MS);
            return { before, maybeReleased, settled: await getViewBox(suite.page) };
        }

        test('a quick drag glides on after release, further than a slow one', async () => {
            // Arrange
            await suite.openSvg();
            const slow = await dragAndRelease({ pauseMs: 200 });
            await suite.openSvg();

            // Act
            const quick = await dragAndRelease({ pauseMs: 0 });

            // Assert
            const slowDistance = slow.settled.x - slow.before.x;
            const quickDistance = quick.settled.x - quick.before.x;
            assert.ok(quickDistance > slowDistance * 1.2, `quick ${quickDistance} should glide past slow ${slowDistance}`);
        });

        test('a drag that stops before release does not glide', async () => {
            // Arrange
            await suite.openSvg();

            // Act
            const { maybeReleased, settled } = await dragAndRelease({ pauseMs: 200 });

            // Assert
            assert.equal(settled.x, maybeReleased?.x);
        });

        test('pressing the mouse stops a glide at once', async () => {
            // Arrange
            await suite.openSvg();
            await suite.page.mouse.move(400, 300);
            await suite.page.mouse.down();
            await suite.page.mouse.move(300, 250, { steps: 5 });
            await suite.page.mouse.up();

            // Act
            await suite.page.mouse.down();

            // Assert
            assert.equal(await suite.page.evaluate(() => document.documentElement.hasAttribute('data-svg-navigator-animating')), false);
            await suite.page.mouse.up();
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

        /**
         * Starts recording every viewBox width the page shows, and every switch of the
         * navigator's animating marker; read them back with `recording`.
         */
        async function startRecording(): Promise<void> {
            await suite.page.evaluate(() => {
                const svg = document.querySelector('svg');
                if (!svg) { throw new Error('no <svg>'); }
                const recording = { widths: [] as number[], animating: [] as boolean[] };
                Object.assign(window, { recording });
                new MutationObserver(() => {
                    recording.widths.push(Number((svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/)[2]));
                }).observe(svg, { attributeFilter: ['viewBox'] });
                new MutationObserver(() => {
                    recording.animating.push(document.documentElement.hasAttribute('data-svg-navigator-animating'));
                }).observe(document.documentElement, { attributeFilter: ['data-svg-navigator-animating'] });
            });
        }

        async function recording(): Promise<{ widths: number[], animating: boolean[] }> {
            return suite.page.evaluate(() => (window as unknown as { recording: { widths: number[], animating: boolean[] } }).recording);
        }

        test('a zoom step eases into place and ends exactly on the step', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);
            await startRecording();

            // Act
            await suite.page.keyboard.press('Equal');
            const settled = await waitForViewBoxChange(suite.page, original);

            // Assert
            // Headless browsers deliver animation frames too irregularly to count in-between
            // views here; unit tests check those against a hand-driven clock.
            const { animating } = await recording();
            assert.deepEqual(animating, [true, false], 'the step should animate, then settle');
            assert.equal(settled.width, original.width * 0.8);
        });

        test('quick repeated zoom steps end exactly where the same steps would without animation', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);

            // Act: three presses, faster than one step takes to settle
            await suite.page.keyboard.press('Equal');
            await suite.page.keyboard.press('Equal');
            await suite.page.keyboard.press('Equal');
            const settled = await waitForViewBoxChange(suite.page, original);

            // Assert
            assert.ok(Math.abs(settled.width - original.width * 0.8 ** 3) < 1e-9 * original.width, `width ${settled.width}`);
            assert.ok(Math.abs((settled.x + settled.width / 2) - (original.x + original.width / 2)) < 1e-9 * original.width, 'stays centered');
        });

        // Firefox's WebDriver BiDi can't emulate media features, so only Chrome checks reduced motion.
        if (browserName === 'chrome') {
            test('jumps straight to each step when the OS asks for reduced motion', async () => {
                // Arrange
                await suite.page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
                await suite.openSvg();
                const original = await getViewBox(suite.page);
                await startRecording();

                // Act
                await suite.page.keyboard.press('Equal');
                await waitForViewBoxChange(suite.page, original);

                // Assert
                const { widths, animating } = await recording();
                assert.deepEqual(widths, [original.width * 0.8]);
                assert.deepEqual(animating, []);
            });
        }

        test('consumes Ctrl =, so the browser does not zoom the whole page as well', async () => {
            // Arrange: the page's own listener runs after the extension's and sees whether it was consumed
            await suite.openSvg();
            await suite.page.evaluate(() => {
                window.addEventListener('keydown', (event) => {
                    document.documentElement.dataset.lastKeyConsumed = String(event.defaultPrevented);
                });
            });

            // Act
            await suite.page.keyboard.down('Control');
            await suite.page.keyboard.press('Equal');
            await suite.page.keyboard.up('Control');

            // Assert
            assert.equal(await suite.page.evaluate(() => document.documentElement.dataset.lastKeyConsumed), 'true');
        });

        test('the right arrow key moves the view right by a tenth of its width', async () => {
            // Arrange
            await suite.openSvg();
            const before = await getViewBox(suite.page);

            // Act
            await suite.page.keyboard.press('ArrowRight');

            // Assert
            const after = await waitForViewBoxChange(suite.page, before);
            assert.ok(Math.abs(after.x - (before.x + before.width / 10)) < 1e-6, `x ${after.x} should be ${before.x + before.width / 10}`);
            assert.equal(after.width, before.width);
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

        test('opens an #svgView link at the view it names', async () => {
            // Act: 200 × 150 matches the 4:3 window, so no fitting changes it
            await suite.openSvg('/simple.svg#svgView(viewBox(100,100,200,150))');

            // Assert
            assert.deepEqual(await getViewBox(suite.page), { x: 100, y: 100, width: 200, height: 150 });
        });

        test('keeps the view in the URL, so a reload returns to it', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);
            await suite.page.keyboard.press('Equal');
            const zoomed = await waitForViewBoxChange(suite.page, original);
            await suite.page.waitForFunction(() => location.hash.startsWith('#svgView('), { timeout: 5_000 });

            // Act
            await suite.page.reload();
            await waitForNavigator(suite.page);

            // Assert
            const reloaded = await getViewBox(suite.page);
            for (const key of ['x', 'y', 'width', 'height'] as const) {
                assert.ok(Math.abs(reloaded[key] - zoomed[key]) < zoomed.width / 1000, `${key}: ${reloaded[key]} vs ${zoomed[key]}`);
            }
        });

        test('clears the link from the URL when the view goes back to the whole drawing', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);
            await suite.page.keyboard.press('Equal');
            await waitForViewBoxChange(suite.page, original);
            await suite.page.waitForFunction(() => location.hash.startsWith('#svgView('), { timeout: 5_000 });

            // Act
            await suite.page.keyboard.press('Escape');

            // Assert
            await suite.page.waitForFunction(() => location.hash === '' && !location.href.endsWith('#'), { timeout: 5_000 });
        });

        test('leaves a fragment that belongs to the SVG alone', async () => {
            // Arrange
            await suite.openSvg('/simple.svg#layer1');
            const original = await getViewBox(suite.page);

            // Act
            await suite.page.keyboard.press('Equal');
            await waitForViewBoxChange(suite.page, original);
            await delay(800);

            // Assert
            assert.equal(await suite.page.evaluate(() => location.hash), '#layer1');
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

        test('stays off on a page turned off in this tab, leaving the original SVG', async () => {
            // Arrange
            await suite.openSvg();
            await suite.page.evaluate((key: string) => sessionStorage.setItem(key, 'true'), pageOffKey(suite.page.url()));

            // Act
            await suite.page.reload();
            await suite.page.waitForSelector('svg[data-svg-navigator="off"]', { timeout: 10_000 });

            // Assert
            assert.equal(await suite.page.evaluate(() => document.documentElement.localName), 'svg');
            assert.equal(await suite.page.$(HUD_HOST), null);
        });

        test('turns off and back on when the popup asks, reloading each time', async () => {
            // Arrange
            await suite.openSvg();
            // The popup messages the active tab; here every tab is asked, and only the SVG answers.
            const setEnabled = (enabled: boolean): Promise<number> => evaluateInExtension(suite.launched(), suite.extensionOrigin(), async (on: boolean) => {
                let answered = 0;
                for (const tab of await chrome.tabs.query({})) {
                    if (tab.id === undefined) { continue; }
                    try {
                        await chrome.tabs.sendMessage(tab.id, { type: 'setPageEnabled', enabled: on });
                        answered++;
                    } catch {
                        // no content script listening in this tab
                    }
                }
                return answered;
            }, enabled);

            // Act
            const answeredOff = await setEnabled(false);
            await suite.page.waitForSelector('svg[data-svg-navigator="off"]', { timeout: 10_000 });
            const answeredOn = await setEnabled(true);

            // Assert
            await waitForNavigator(suite.page);
            assert.ok(await suite.page.$(HUD_HOST), 'HUD should be back');
            assert.deepEqual([answeredOff, answeredOn], [1, 1], 'only the SVG tab should answer');
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
