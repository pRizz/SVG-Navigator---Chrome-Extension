/**
 * Generates the README's looping demo, `docs/images/readme-demo.webp`: the world map
 * zoomed and panned with the built extension, in the same browser-neutral window as
 * `readme-hero.png`, with a drawn pointer and a caption for each step.
 *
 * It records frame by frame instead of filming in real time: each frame sends one small
 * wheel or pointer step, waits for the view to settle, and captures it, so the frames
 * don't depend on timing and reruns produce the same file. ffmpeg (with libwebp) joins
 * the frames, which are kept in `.build/readme-animation/` for inspection.
 *
 * Run with `bun run screenshots:readme`.
 */

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'puppeteer';
import { fillTemplate } from './fillTemplate.ts';
import {
    type CaptureContext,
    dataUrl,
    DISPLAYED_HOST,
    freezeAnimations,
    launchComposer,
    type Point,
    preparePage,
    repoRoot,
    waitForMinimapToSettle,
    withCaptureContext,
    WORLD_MAP,
} from './screenshotCapture.ts';
import { evaluateInExtension, getViewBox, waitForNavigator, waitForViewBoxChange } from '../test/e2e/harness.ts';

const TAU = 2 * Math.PI;
/**
 * 16:9 like `readme-hero.png`. Rendered at 2x, because a fractional device scale lets
 * Chrome raster layers at interim scales that vary from run to run, then scaled to
 * `OUTPUT_WIDTH`: sharp at the README's width, small enough to load fast.
 */
const CANVAS = { width: 1280, height: 720, scale: 2 } as const;
const OUTPUT_WIDTH = 1600;
const VIEWPORT = { width: 1120, height: 480 } as const;
const FPS = 20;
const TITLE = 'Infinite zoom for any SVG';

const framesDir = new URL('.build/readme-animation/', repoRoot);
const outputFile = new URL('docs/images/readme-demo.webp', repoRoot);

/** Eases 0..1 in and out, so moves start and stop gently. */
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Splits `total` into `count` steps that swell and fade, like a flick of the wheel. */
function easedSteps(total: number, count: number): number[] {
    const weights = Array.from({ length: count }, (_, index) => Math.sin(TAU / 2 * (index + 0.5) / count));
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((weight) => total * weight / sum);
}

/**
 * Waits for the page to paint its last change. Pointer moves arrive aligned to animation
 * frames, so a drag's last move can land a frame after the event returns, and a swapped
 * image can show with its first, rougher edges until the next paint.
 */
async function nextPaint(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
}

/** Drives the map page and writes one composed frame per step. */
class Recorder {
    readonly #map: Page;
    readonly #stage: Page;
    #frameCount = 0;
    #cursor: Point;
    #isPressed = false;
    #caption = '';

    constructor(map: Page, stage: Page, start: Point) {
        this.#map = map;
        this.#stage = stage;
        this.#cursor = start;
    }

    get frameCount(): number {
        return this.#frameCount;
    }

    caption(text: string): void {
        this.#caption = text;
    }

    /** Captures the map and composes it into the frame. */
    async frame(): Promise<void> {
        await waitForMinimapToSettle(this.#map);
        const page = dataUrl(await this.#map.screenshot({ type: 'png' }));
        await this.#stage.evaluate(async (src, cursor, isPressed, caption) => {
            const image = document.querySelector<HTMLImageElement>('.page');
            const pointer = document.querySelector<HTMLElement>('.cursor');
            const subtitle = document.querySelector<HTMLElement>('.subtitle');
            if (!image || !pointer || !subtitle) { throw new Error('The frame is missing .page, .cursor, or .subtitle'); }
            image.src = src;
            await image.decode();
            pointer.hidden = false;
            pointer.style.transform = `translate(${cursor.x}px, ${cursor.y}px)`;
            pointer.classList.toggle('pressed', isPressed);
            subtitle.textContent = caption;
        }, page, this.#cursor, this.#isPressed, this.#caption);
        await nextPaint(this.#stage);
        this.#frameCount++;
        const name = `frame-${String(this.#frameCount).padStart(4, '0')}.png`;
        await writeFile(new URL(name, framesDir), await this.#stage.screenshot({ type: 'png' }));
    }

    async hold(frames: number): Promise<void> {
        for (let index = 0; index < frames; index++) {
            await this.frame();
        }
    }

    /** Moves the pointer to `target` over `frames` frames, dragging the view if pressed. */
    async moveTo(target: Point, frames: number): Promise<void> {
        const start = this.#cursor;
        for (let index = 1; index <= frames; index++) {
            const t = smoothstep(index / frames);
            this.#cursor = { x: start.x + (target.x - start.x) * t, y: start.y + (target.y - start.y) * t };
            await this.#map.mouse.move(this.#cursor.x, this.#cursor.y);
            await nextPaint(this.#map);
            await this.frame();
        }
    }

    /** Scrolls `totalDeltaY` at the pointer over `frames` frames (negative zooms in). */
    async scroll(totalDeltaY: number, frames: number): Promise<void> {
        for (const deltaY of easedSteps(totalDeltaY, frames)) {
            const before = await getViewBox(this.#map);
            await this.#map.mouse.wheel({ deltaY });
            await waitForViewBoxChange(this.#map, before);
            await nextPaint(this.#map);
            await this.frame();
        }
    }

    async press(): Promise<void> {
        await this.#map.mouse.down();
        await nextPaint(this.#map);
        this.#isPressed = true;
    }

    /** Lets go after the pointer has stopped, so the pan doesn't glide on. */
    async release(): Promise<void> {
        await this.#map.mouse.up();
        await nextPaint(this.#map);
        this.#isPressed = false;
    }

    async key(name: 'Escape'): Promise<void> {
        await this.#map.keyboard.press(name);
        await nextPaint(this.#map);
    }
}

/**
 * The demo itself: zoom into Europe, drag the Aegean to the middle, dive into its
 * islands, and reset. Points are in the page's CSS pixels; the readouts in the comments
 * are what the HUD shows after each step.
 */
async function perform(recorder: Recorder): Promise<void> {
    recorder.caption('Open any SVG file in your browser');
    await recorder.hold(12);
    recorder.caption('Scroll to zoom in at the pointer');
    await recorder.moveTo({ x: 540, y: 95 }, 12);
    await recorder.scroll(-340, 30); // about 350%
    await recorder.hold(6);
    recorder.caption('Drag to pan');
    await recorder.moveTo({ x: 700, y: 200 }, 8);
    await recorder.press();
    await recorder.hold(3);
    await recorder.moveTo({ x: 470, y: 200 }, 26);
    await recorder.hold(3);
    await recorder.release();
    recorder.caption('Keep zooming: vector graphics stay sharp');
    await recorder.moveTo({ x: 525, y: 262 }, 10);
    await recorder.scroll(-400, 40); // about 1500%
    await recorder.hold(16);
    recorder.caption('Press Esc to see the whole drawing again');
    await recorder.hold(6);
    await recorder.key('Escape');
    await recorder.moveTo({ x: 760, y: 330 }, 12);
    await recorder.hold(8);
}

async function openStage(composer: Browser): Promise<Page> {
    const frame = await readFile(new URL('scripts/readmeHeroFrame.html', repoRoot), 'utf8');
    const html = fillTemplate(frame, {
        canvasWidth: String(CANVAS.width),
        canvasHeight: String(CANVAS.height),
        viewportWidth: String(VIEWPORT.width),
        viewportHeight: String(VIEWPORT.height),
        title: TITLE,
        subtitle: '',
        displayedHost: DISPLAYED_HOST,
        toolbarIcon: dataUrl(await readFile(new URL('src/icon_38.png', repoRoot))),
        // Replaced by each frame's capture.
        page: '',
    });
    const stage = await composer.newPage();
    await preparePage(stage, CANVAS, CANVAS.scale);
    await stage.setContent(html, { waitUntil: 'load' });
    return stage;
}

async function openMap({ browser, extensionOrigin, origin }: CaptureContext): Promise<Page> {
    await evaluateInExtension(browser, extensionOrigin, async () => {
        await chrome.storage.sync.clear();
        await chrome.storage.sync.set({ toolbarAutoHide: false });
    });
    const map = await browser.newPage();
    await preparePage(map, VIEWPORT, CANVAS.scale);
    await map.goto(`${origin}/${encodeURIComponent(WORLD_MAP)}`);
    await waitForNavigator(map);
    await freezeAnimations(map);
    return map;
}

/** Fails before the slow capture if ffmpeg or its libwebp encoder is missing. */
function checkEncoder(): void {
    let encoders: string;
    try {
        encoders = execFileSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
    } catch (error) {
        throw new Error('ffmpeg is needed to encode the demo; install it (e.g. brew install ffmpeg)', { cause: error });
    }
    if (!encoders.includes('libwebp_anim')) {
        throw new Error('This ffmpeg lacks the libwebp_anim encoder; install a build with libwebp');
    }
}

function encode(): void {
    execFileSync('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-framerate', String(FPS),
        // Joined as a path: in a URL, `%04` would read as an escape.
        '-i', path.join(fileURLToPath(framesDir), 'frame-%04d.png'),
        '-vf', `scale=${OUTPUT_WIDTH}:-1:flags=lanczos`,
        '-c:v', 'libwebp_anim', '-lossless', '0', '-quality', '60', '-compression_level', '6',
        '-loop', '0',
        fileURLToPath(outputFile),
    ], { stdio: 'inherit' });
}

async function main(): Promise<void> {
    checkEncoder();
    await rm(framesDir, { recursive: true, force: true });
    await mkdir(framesDir, { recursive: true });
    await withCaptureContext(async (context) => {
        const composer = await launchComposer();
        try {
            const map = await openMap(context);
            const recorder = new Recorder(map, await openStage(composer), { x: 760, y: 330 });
            await map.mouse.move(760, 330);
            await perform(recorder);
            console.log(`Captured ${recorder.frameCount} frames in .build/readme-animation/`);
        } finally {
            await composer.close();
        }
    });
    encode();
    console.log('Wrote docs/images/readme-demo.webp');
}

await main();
