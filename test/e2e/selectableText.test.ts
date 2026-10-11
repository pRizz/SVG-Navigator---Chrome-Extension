/**
 * Cross-browser UI tests for the Selectable text setting (#32): with it on, a drag or
 * double-click that starts on text selects it; everywhere else the drawing still pans.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BROWSERS, delay, getViewBox, waitForViewBoxChange } from './harness.ts';
import { useExtensionSuite } from './suite.ts';

/** Long enough for a stray pan or zoom to have landed. */
const SETTLE_MS = 300;

for (const browserName of BROWSERS) {
    describe(browserName, () => {
        const suite = useExtensionSuite(browserName);

        /** The text's box on screen, inset a little so presses land on its glyphs. */
        async function labelBox(): Promise<{ left: number, right: number, middle: number }> {
            return suite.page.$eval('#label', (label) => {
                const box = label.getBoundingClientRect();
                return { left: box.left + 4, right: box.right - 4, middle: box.top + box.height / 2 };
            });
        }

        async function drag(from: { x: number, y: number }, to: { x: number, y: number }): Promise<void> {
            await suite.page.mouse.move(from.x, from.y);
            await suite.page.mouse.down();
            await suite.page.mouse.move(to.x, to.y, { steps: 8 });
            await suite.page.mouse.up();
        }

        const selectedText = (): Promise<string> => suite.page.evaluate(() => getSelection()?.toString() ?? '');

        test('with Selectable text on, dragging across text selects it instead of panning', async () => {
            // Arrange
            await suite.setSettings({ selectableText: true });
            await suite.openSvg('/text.svg');
            const before = await getViewBox(suite.page);
            const { left, right, middle } = await labelBox();

            // Act
            await drag({ x: left, y: middle }, { x: right, y: middle });
            await delay(SETTLE_MS);

            // Assert
            assert.match(await selectedText(), /Selectable words here/);
            assert.deepEqual(await getViewBox(suite.page), before);
        });

        test('with Selectable text on and drag set to zoom box, dragging across text selects it', async () => {
            // Arrange
            await suite.setSettings({ selectableText: true, clickAndDragBehavior: 'zoomBox' });
            await suite.openSvg('/text.svg');
            const before = await getViewBox(suite.page);
            const { left, right, middle } = await labelBox();

            // Act
            await drag({ x: left, y: middle }, { x: right, y: middle });
            await delay(SETTLE_MS);

            // Assert
            assert.match(await selectedText(), /Selectable words here/);
            assert.deepEqual(await getViewBox(suite.page), before);
        });

        test('with Selectable text off, dragging across text pans and selects nothing', async () => {
            // Arrange
            await suite.openSvg('/text.svg');
            const before = await getViewBox(suite.page);
            const { left, right, middle } = await labelBox();

            // Act
            await drag({ x: left, y: middle }, { x: right, y: middle });

            // Assert
            await waitForViewBoxChange(suite.page, before);
            assert.equal(await selectedText(), '');
        });

        test('with Selectable text on, dragging from outside text still pans and selects nothing', async () => {
            // Arrange
            await suite.setSettings({ selectableText: true });
            await suite.openSvg('/text.svg');
            const before = await getViewBox(suite.page);
            const { left, middle } = await labelBox();

            // Act
            await drag({ x: left, y: middle - 120 }, { x: left + 100, y: middle });

            // Assert
            await waitForViewBoxChange(suite.page, before);
            assert.equal(await selectedText(), '');
        });

        test('with Selectable text on, double-clicking a word selects it without zooming', async () => {
            // Arrange
            await suite.setSettings({ selectableText: true });
            await suite.openSvg('/text.svg');
            const before = await getViewBox(suite.page);
            const { left, middle } = await labelBox();

            // Act
            await suite.page.mouse.click(left + 20, middle, { count: 2 });
            await delay(SETTLE_MS);

            // Assert
            assert.equal((await selectedText()).trim(), 'Selectable');
            assert.deepEqual(await getViewBox(suite.page), before);
        });

        test('with Selectable text on, text shows a text cursor', async () => {
            // Arrange
            await suite.setSettings({ selectableText: true });

            // Act
            await suite.openSvg('/text.svg');

            // Assert
            assert.equal(await suite.page.$eval('#label', (label) => getComputedStyle(label).cursor), 'text');
        });

        test('turning Selectable text on applies without reloading', async () => {
            // Arrange
            await suite.openSvg('/text.svg');
            const before = await getViewBox(suite.page);
            const { left, right, middle } = await labelBox();

            // Act
            await suite.setSettings({ selectableText: true });
            await suite.page.waitForFunction(() => document.documentElement.hasAttribute('data-svg-navigator-selectable-text'), { timeout: 5_000 });
            await drag({ x: left, y: middle }, { x: right, y: middle });
            await delay(SETTLE_MS);

            // Assert
            assert.match(await selectedText(), /Selectable words here/);
            assert.deepEqual(await getViewBox(suite.page), before);
        });
    });
}
