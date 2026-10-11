/**
 * Cross-browser UI tests for the HUD's Export menu (#51): PNGs of the view, the SVG as
 * authored, links to the view, and switching back to the original SVG.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    BROWSERS,
    HUD_HOST,
    getViewBox,
    hudElement,
    hudText,
    waitForDownload,
    waitForHudAttribute,
    waitForViewBoxChange,
} from './harness.ts';
import { useExtensionSuite } from './suite.ts';

const fixturesDir = new URL('fixtures/', import.meta.url);

interface Rgba {
    r: number;
    g: number;
    b: number;
    a: number;
}

/** A PNG's size, from its IHDR chunk. */
function pngDimensions(png: Buffer): { width: number, height: number } {
    return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

for (const browserName of BROWSERS) {
    describe(browserName, () => {
        const suite = useExtensionSuite(browserName);

        async function openExportMenu(): Promise<void> {
            await (await hudElement(suite.page, '.export')).click();
            await waitForHudAttribute(suite.page, '#export', 'hidden', null);
        }

        async function waitForStatus(expected: string): Promise<void> {
            await suite.page.waitForFunction(
                (host: string, text: string) => document.querySelector(host)?.shadowRoot?.querySelector('.export-status')?.textContent === text,
                { timeout: 10_000 },
                HUD_HOST,
                expected,
            );
        }

        async function zoomIn(): Promise<void> {
            const before = await getViewBox(suite.page);
            await suite.page.keyboard.press('+');
            await waitForViewBoxChange(suite.page, before);
        }

        /** The drawing's size on screen, which a 1× PNG matches. */
        async function drawingSize(): Promise<{ width: number, height: number }> {
            return suite.page.$eval('svg', (svg) => {
                const box = svg.getBoundingClientRect();
                return { width: box.width, height: box.height };
            });
        }

        /** Colors in a PNG at fractions of its width and height, decoded by the page. */
        async function pngColorsAt(png: Buffer, points: readonly { fx: number, fy: number }[]): Promise<Rgba[]> {
            return suite.page.evaluate(async (base64: string, at: readonly { fx: number, fy: number }[]) => {
                const image = new Image();
                image.src = `data:image/png;base64,${base64}`;
                await image.decode();
                // The page is an XML document, whose createElement makes no real canvas.
                const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas') as HTMLCanvasElement;
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                const context = canvas.getContext('2d');
                if (context === null) { throw new Error('no 2d context'); }
                context.drawImage(image, 0, 0);
                return at.map(({ fx, fy }) => {
                    const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(Math.floor(fx * canvas.width), Math.floor(fy * canvas.height), 1, 1).data;
                    return { r, g, b, a };
                });
            }, png.toString('base64'), points);
        }

        /** Whether two SVG texts parse to the same markup, ignoring attribute order and quoting. */
        async function isSameMarkup(a: string, b: string): Promise<boolean> {
            return suite.page.evaluate((first: string, second: string) => {
                const parse = (text: string): Element => new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
                return parse(first).isEqualNode(parse(second));
            }, a, b);
        }

        test('Export lists PNG sizes alongside the other exports', async () => {
            // Arrange
            await suite.openSvg();
            const size = await drawingSize();

            // Act
            await openExportMenu();

            // Assert
            const twice = await hudText(suite.page, '.export-png[data-scale="2"]');
            assert.equal(twice, `2×${Math.round(size.width * 2)} × ${Math.round(size.height * 2)}`);
            for (const item of ['.export-copy-link', '.export-svg', '.export-copy-source', '.export-show-original']) {
                await hudElement(suite.page, item);
            }
        });

        test('saves the view as a PNG at the chosen scale', async () => {
            // Arrange
            await suite.openSvg();
            await zoomIn();
            await openExportMenu();
            const size = await drawingSize();

            // Act
            await (await hudElement(suite.page, '.export-png[data-scale="2"]')).click();

            // Assert
            const png = await waitForDownload(suite.downloadDir(), 'simple@2x.png');
            assert.deepEqual(pngDimensions(png), { width: Math.round(size.width * 2), height: Math.round(size.height * 2) });
            await waitForStatus('Saved simple@2x.png');
        });

        test('the PNG has a transparent background and embeds linked images', async () => {
            // Arrange
            await suite.setSettings({ svgBackgroundColor: 'black' });
            await suite.openSvg('/linked-image.svg');
            await openExportMenu();

            // Act
            await (await hudElement(suite.page, '.export-png[data-scale="1"]')).click();

            // Assert
            const png = await waitForDownload(suite.downloadDir(), 'linked-image.png');
            const [image, circle, empty] = await pngColorsAt(png, [{ fx: 0.25, fy: 0.5 }, { fx: 0.75, fy: 0.5 }, { fx: 0.97, fy: 0.03 }]);
            assert.deepEqual(image, { r: 255, g: 0, b: 0, a: 255 }, 'the linked image is drawn');
            assert.deepEqual(circle, { r: 0x33, g: 0x66, b: 0xcc, a: 255 }, 'the drawing is drawn');
            assert.equal(empty?.a, 0, 'the background is transparent');
            await waitForStatus('Saved linked-image.png');
        });

        test('says which linked images it couldn\'t include', async () => {
            // Arrange
            await suite.openSvg('/broken-image.svg');
            await openExportMenu();

            // Act
            await (await hudElement(suite.page, '.export-png[data-scale="1"]')).click();

            // Assert
            await waitForDownload(suite.downloadDir(), 'broken-image.png');
            await waitForStatus('Saved broken-image.png without 1 linked image that couldn\'t be loaded');
        });

        test('Download SVG saves the drawing as authored, without the navigator\'s changes', async () => {
            // Arrange
            await suite.openSvg('/authored.svg');
            await zoomIn();
            await openExportMenu();

            // Act
            await (await hudElement(suite.page, '.export-svg')).click();

            // Assert
            const saved = await waitForDownload(suite.downloadDir(), 'authored.svg');
            const authored = await readFile(fileURLToPath(new URL('authored.svg', fixturesDir)), 'utf8');
            assert.ok(await isSameMarkup(saved.toString('utf8'), authored), `saved:\n${saved.toString('utf8')}`);
            await waitForStatus('Saved authored.svg');
        });

        test('Show the original SVG turns the navigator off in this tab', async () => {
            // Arrange
            await suite.openSvg();
            await openExportMenu();

            // Act
            await (await hudElement(suite.page, '.export-show-original')).click();

            // Assert
            await suite.page.waitForSelector('svg[data-svg-navigator="off"]', { timeout: 10_000 });
        });

        test('Escape closes the Export menu without resetting the view', async () => {
            // Arrange
            await suite.openSvg();
            await zoomIn();
            const zoomed = await getViewBox(suite.page);
            await openExportMenu();

            // Act
            await suite.page.keyboard.press('Escape');

            // Assert
            await waitForHudAttribute(suite.page, '#export', 'hidden', '');
            assert.deepEqual(await getViewBox(suite.page), zoomed);
        });

        test('from the keyboard, Export moves focus into the menu and Escape brings it back', async () => {
            // Arrange
            await suite.openSvg();
            const focusedClass = (): Promise<string | undefined> => suite.page.evaluate(
                (host: string) => document.querySelector(host)?.shadowRoot?.activeElement?.className,
                HUD_HOST,
            );
            await (await hudElement(suite.page, '.export')).focus();

            // Act
            await suite.page.keyboard.press('Enter');
            await waitForHudAttribute(suite.page, '#export', 'hidden', null);
            const inMenu = await focusedClass();
            await suite.page.keyboard.press('Escape');
            await waitForHudAttribute(suite.page, '#export', 'hidden', '');

            // Assert
            assert.equal(inMenu, 'menu-item export-copy-link');
            assert.equal(await focusedClass(), 'utility export');
        });

        test('opening Export closes the shortcuts list', async () => {
            // Arrange
            await suite.openSvg();
            await (await hudElement(suite.page, '.shortcuts')).click();
            await waitForHudAttribute(suite.page, '#shortcuts', 'hidden', null);

            // Act
            await openExportMenu();

            // Assert
            await waitForHudAttribute(suite.page, '#shortcuts', 'hidden', '');
        });

        // Firefox's WebDriver BiDi offers no clipboard permission override, so only Chrome can read it back.
        if (browserName === 'chrome') {
            async function readClipboardAfter(item: string, status: string): Promise<string> {
                await openExportMenu();
                await (await hudElement(suite.page, item)).click();
                await waitForStatus(status);
                return suite.page.evaluate(() => navigator.clipboard.readText());
            }

            test('Copy link copies a link to the current view', async () => {
                // Arrange
                await suite.launched().defaultBrowserContext().overridePermissions(suite.fixtureOrigin(), ['clipboard-read', 'clipboard-sanitized-write']);
                await suite.openSvg();
                await suite.page.bringToFront();
                await zoomIn();
                const view = await getViewBox(suite.page);

                // Act
                const copied = await readClipboardAfter('.export-copy-link', 'Link copied');

                // Assert
                assert.equal(copied, `${suite.fixtureOrigin()}/simple.svg#svgView(viewBox(${view.x},${view.y},${view.width},${view.height}))`);
            });

            test('Copy SVG source copies the drawing as authored', async () => {
                // Arrange
                await suite.launched().defaultBrowserContext().overridePermissions(suite.fixtureOrigin(), ['clipboard-read', 'clipboard-sanitized-write']);
                await suite.openSvg('/authored.svg');
                await suite.page.bringToFront();
                await zoomIn();

                // Act
                const copied = await readClipboardAfter('.export-copy-source', 'SVG source copied');

                // Assert
                const authored = await readFile(fileURLToPath(new URL('authored.svg', fixturesDir)), 'utf8');
                assert.ok(await isSameMarkup(copied, authored), `copied:\n${copied}`);
            });
        }
    });
}
