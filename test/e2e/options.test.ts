/**
 * Cross-browser UI tests for the options popup: it shows stored settings and saves
 * every change to sync storage.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BROWSERS, clickInExtensionPage, openOptionsPage, waitForStoredSetting } from './harness.ts';
import { useExtensionSuite } from './suite.ts';

for (const browserName of BROWSERS) {
    describe(browserName, () => {
        const suite = useExtensionSuite(browserName);

        test('options popup renders its settings', async () => {
            // Act
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Assert
            const text = await suite.page.$eval('body', (body) => (body as HTMLElement).innerText);
            assert.match(text, /Click and drag/);
            assert.match(text, /Scroll sensitivity/);
            assert.match(text, /Background color/);
            assert.deepEqual(suite.pageErrors, []);
        });

        test('options popup footer shows the version, commit, and build time', async () => {
            // Act
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Assert
            const text = await suite.page.$eval('#versionInfo', (footer) => footer.textContent);
            assert.match(text, /^Version [\d.]+ · Commit ([0-9a-f]{7}|Unavailable) · Built \d{4}-\d\d-\d\d \d\d:\d\d UTC$/);
        });

        test('options popup footer links to the source in a new tab', async () => {
            // Act
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Assert
            const link = await suite.page.$eval('.footer-links a[href^="https://github.com/"]', (anchor) => ({ target: anchor.target, rel: anchor.rel }));
            assert.deepEqual(link, { target: '_blank', rel: 'noopener noreferrer' });
        });

        test('options popup lists the controls from the shared shortcut list', async () => {
            // Act
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Assert
            const controls = await suite.page.$$eval('#controls .row', (rows) => rows.map((row) => ({
                action: row.querySelector('.row-label')?.textContent,
                keys: [...row.querySelectorAll('kbd')].map((kbd) => kbd.textContent),
            })));
            assert.ok(controls.some(({ action }) => action === 'Zoom to an area'), JSON.stringify(controls));
            assert.deepEqual(controls.find(({ action }) => action === 'Reset view')?.keys, ['Esc', '0']);
        });

        test('options popup shows the stored settings', async () => {
            // Arrange
            await suite.setSettings({
                clickAndDragBehavior: 'zoomBox',
                scrollSensitivity: 3.5,
                toolbarEnabled: false,
                svgBackgroundColor: 'black',
            });

            // Act
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Assert
            const shown = await suite.page.evaluate(() => ({
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
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Act
            await clickInExtensionPage(suite.page, '#toolbarEnabled');

            // Assert
            await waitForStoredSetting(suite.page, 'toolbarEnabled', false);
        });

        test('options popup saves a typed background color even when closed right away', async () => {
            // Arrange
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Act: type, then close the popup before the save delay elapses.
            await suite.page.evaluate(() => {
                const input = document.querySelector<HTMLInputElement>('#svgBackgroundColor');
                if (!input) { throw new Error('missing #svgBackgroundColor'); }
                input.value = 'black';
                input.dispatchEvent(new Event('input'));
            });
            await suite.page.close();
            suite.page = await suite.launched().newPage();

            // Assert
            await openOptionsPage(suite.page, suite.extensionOrigin());
            await waitForStoredSetting(suite.page, 'svgBackgroundColor', 'black');
        });

        test('options popup saves the clicked color preset', async () => {
            // Arrange
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Act
            await clickInExtensionPage(suite.page, '.preset[data-color="black"]');

            // Assert
            await waitForStoredSetting(suite.page, 'svgBackgroundColor', 'black');
            assert.equal(await suite.page.$eval('#svgBackgroundColor', (input) => (input as HTMLInputElement).value), 'black');
        });

        test('options popup resets every setting after a confirming second click', async () => {
            // Arrange
            await suite.setSettings({ scrollSensitivity: 2, toolbarEnabled: false, svgBackgroundColor: 'black' });
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Act
            await clickInExtensionPage(suite.page, '#resetAll');
            await clickInExtensionPage(suite.page, '#resetAll');

            // Assert
            await waitForStoredSetting(suite.page, 'scrollSensitivity', 7);
            await waitForStoredSetting(suite.page, 'toolbarEnabled', true);
            await waitForStoredSetting(suite.page, 'svgBackgroundColor', 'white');
            assert.equal(await suite.page.$eval('#scrollSensitivity', (input) => (input as HTMLInputElement).value), '7');
        });

        test('options popup does not reset on a single click', async () => {
            // Arrange
            await suite.setSettings({ scrollSensitivity: 2 });
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Act
            await clickInExtensionPage(suite.page, '#resetAll');

            // Assert
            await waitForStoredSetting(suite.page, 'scrollSensitivity', 2);
            assert.match(await suite.page.$eval('#resetAll', (button) => button.textContent ?? ''), /Click again/);
        });

        test('options popup saves the chosen toolbar position', async () => {
            // Arrange
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Act
            await clickInExtensionPage(suite.page, 'input[name="toolbarPosition"][value="left"]');

            // Assert
            await waitForStoredSetting(suite.page, 'toolbarPosition', 'left');
        });

        test('options popup disables the position picker while the toolbar is off', async () => {
            // Arrange
            await suite.setSettings({ toolbarEnabled: false });

            // Act
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Assert
            const allDisabled = await suite.page.evaluate(() =>
                [...document.querySelectorAll<HTMLInputElement>('input[name="toolbarPosition"]')].every((input) => input.disabled),
            );
            assert.equal(allDisabled, true);
        });
    });
}
