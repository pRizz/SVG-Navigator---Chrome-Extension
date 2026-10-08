/**
 * The per-browser test lifecycle every E2E file shares: one fixture server and one
 * browser per `describe`, a fresh page per test, a screenshot of every failure, and
 * settings cleared after each test.
 */

import { after, afterEach, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'puppeteer';
import { evaluateInExtension, launchWithExtension, startFixtureServer, waitForNavigator } from './harness.ts';

const screenshotDir = fileURLToPath(new URL('../../test-results/e2e-screenshots/', import.meta.url));

export class ExtensionSuite {
    readonly browserName: string;
    pageErrors: string[] = [];
    #maybeServer: Awaited<ReturnType<typeof startFixtureServer>> | undefined;
    #maybeBrowser: Browser | undefined;
    #maybeExtensionOrigin: string | undefined;
    #maybePage: Page | undefined;

    constructor(browserName: string) {
        this.browserName = browserName;
    }

    /** The current test's page; only valid inside tests and per-test hooks. */
    get page(): Page {
        assert.ok(this.#maybePage, 'no page outside a test');
        return this.#maybePage;
    }

    /** Replaces the current page, e.g. after a test closes it on purpose. */
    set page(page: Page) {
        this.#maybePage = page;
        this.pageErrors = [];
        page.on('pageerror', (error) => this.pageErrors.push(error instanceof Error ? error.message : String(error)));
    }

    launched(): Browser {
        assert.ok(this.#maybeBrowser, `${this.browserName} failed to launch`);
        return this.#maybeBrowser;
    }

    fixtureOrigin(): string {
        assert.ok(this.#maybeServer, 'fixture server failed to start');
        return this.#maybeServer.origin;
    }

    extensionOrigin(): string {
        assert.ok(this.#maybeExtensionOrigin, `${this.browserName} has no extension origin`);
        return this.#maybeExtensionOrigin;
    }

    async openSvg(fixturePath = '/simple.svg'): Promise<void> {
        await this.page.goto(`${this.fixtureOrigin()}${fixturePath}`);
        await waitForNavigator(this.page);
    }

    /** Writes settings to sync storage, as the options popup would. */
    async setSettings(settings: Record<string, unknown>): Promise<void> {
        await evaluateInExtension(
            this.launched(),
            this.extensionOrigin(),
            (stored: Record<string, unknown>) => chrome.storage.sync.set(stored),
            settings,
        );
    }

    async setUp(): Promise<void> {
        this.#maybeServer = await startFixtureServer();
        const { browser, extensionOrigin } = await launchWithExtension(this.browserName);
        this.#maybeBrowser = browser;
        this.#maybeExtensionOrigin = extensionOrigin;
    }

    async tearDown(): Promise<void> {
        await this.#maybeBrowser?.close();
        await this.#maybeServer?.close();
    }

    async beforeTest(): Promise<void> {
        this.page = await this.launched().newPage();
    }

    async afterTest(t: { name: string }): Promise<void> {
        // `passed` exists at runtime (Bun's node:test, Node >= 20.12) but is missing from @types/node 22.
        if (!('passed' in t && t.passed === true)) {
            await mkdir(screenshotDir, { recursive: true });
            const name = `${this.browserName}-${t.name}`.replace(/[^a-z0-9-]+/gi, '_');
            await this.page.screenshot({ path: path.join(screenshotDir, `${name}.png`) });
        }
        await this.page.close();
        await evaluateInExtension(this.launched(), this.extensionOrigin(), () => chrome.storage.sync.clear());
    }
}

/** Registers the suite's hooks in the enclosing `describe` and returns it. */
export function useExtensionSuite(browserName: string): ExtensionSuite {
    const suite = new ExtensionSuite(browserName);
    before(() => suite.setUp());
    after(() => suite.tearDown());
    beforeEach(() => suite.beforeTest());
    afterEach((t) => suite.afterTest(t));
    return suite;
}
