import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createViewAnimator, easeOutCubic, interpolateViewBox, type FrameScheduler } from '../../src/js/viewAnimation.ts';
import { zoomAroundPoint, type ViewBox } from '../../src/js/viewBox.ts';

const START: ViewBox = { x: 0, y: 0, width: 800, height: 600 };

/** A clock and frame queue the test advances by hand. */
function fakeFrames(): FrameScheduler & { tick: (ms: number) => void } {
    let now = 0;
    let maybeCallback: ((time: number) => void) | null = null;
    return {
        now: () => now,
        request: (callback) => {
            maybeCallback = callback;
            return 1;
        },
        cancel: () => {
            maybeCallback = null;
        },
        tick: (ms) => {
            now += ms;
            const callback = maybeCallback;
            maybeCallback = null;
            callback?.(now);
        },
    };
}

describe('interpolateViewBox', () => {
    test('starts at the first view', () => {
        assert.deepEqual(interpolateViewBox(START, zoomAroundPoint(START, { x: 100, y: 100 }, 0.5), 0), START);
    });

    test('ends exactly at the second view', () => {
        // Arrange
        const end = zoomAroundPoint(START, { x: 100, y: 100 }, 0.5);

        // Act
        const view = interpolateViewBox(START, end, 1);

        // Assert
        assert.deepEqual(view, end);
    });

    test('keeps a zoom\'s fixed point in place on screen throughout', () => {
        // Arrange
        const point = { x: 200, y: 150 };
        const end = zoomAroundPoint(START, point, 0.25);

        // Act
        const halfway = interpolateViewBox(START, end, 0.5);

        // Assert: the point sits at the same fraction across the view
        assert.ok(Math.abs((point.x - halfway.x) / halfway.width - (point.x - START.x) / START.width) < 1e-12);
        assert.ok(Math.abs((point.y - halfway.y) / halfway.height - (point.y - START.y) / START.height) < 1e-12);
    });

    test('scales geometrically, so halfway through a 4× zoom is 2×', () => {
        // Act
        const halfway = interpolateViewBox(START, zoomAroundPoint(START, { x: 0, y: 0 }, 0.25), 0.5);

        // Assert
        assert.ok(Math.abs(halfway.width - 400) < 1e-9, `width ${halfway.width}`);
    });

    test('moves a pure pan in a straight line', () => {
        assert.deepEqual(interpolateViewBox(START, { ...START, x: 100, y: -50 }, 0.5), { ...START, x: 50, y: -25 });
    });
});

describe('easeOutCubic', () => {
    test('runs from 0 to 1, fast at first', () => {
        // Act
        const values = [0, 0.5, 1].map(easeOutCubic);

        // Assert
        assert.deepEqual(values, [0, 0.875, 1]);
    });
});

describe('createViewAnimator', () => {
    test('shows intermediate views and ends exactly on the target', () => {
        // Arrange
        const frames = fakeFrames();
        const shown: ViewBox[] = [];
        const animator = createViewAnimator({ frames, durationMs: 100, current: () => shown.at(-1) ?? START, show: (view) => shown.push(view) });
        const target = zoomAroundPoint(START, { x: 400, y: 300 }, 0.5);

        // Act
        animator.animateTo(target);
        for (let frame = 0; frame < 5; frame++) { frames.tick(25); }

        // Assert
        assert.ok(shown.length >= 3, `${shown.length} frames`);
        assert.ok((shown[0]?.width ?? 0) > target.width && (shown[0]?.width ?? 0) < START.width, 'first frame is in between');
        assert.deepEqual(shown.at(-1), target);
        assert.equal(animator.maybeTarget(), null);
    });

    test('takes a longer duration for one animation when asked, as a glide does', () => {
        // Arrange
        const frames = fakeFrames();
        const shown: ViewBox[] = [];
        const animator = createViewAnimator({ frames, durationMs: 100, current: () => shown.at(-1) ?? START, show: (view) => shown.push(view) });
        const target = { ...START, x: 100 };

        // Act
        animator.animateTo(target, 400);
        frames.tick(200);

        // Assert: halfway through 400 ms, not finished as it would be at 100 ms
        assert.notDeepEqual(shown.at(-1), target);
        assert.deepEqual(animator.maybeTarget(), target);
    });

    test('reports its target while animating, so the next step can build on it', () => {
        // Arrange
        const frames = fakeFrames();
        const animator = createViewAnimator({ frames, durationMs: 100, current: () => START, show: () => undefined });
        const target = { ...START, x: 50 };

        // Act
        animator.animateTo(target);

        // Assert
        assert.deepEqual(animator.maybeTarget(), target);
    });

    test('retargets from wherever the view is when a new target arrives', () => {
        // Arrange
        const frames = fakeFrames();
        const shown: ViewBox[] = [];
        const animator = createViewAnimator({ frames, durationMs: 100, current: () => shown.at(-1) ?? START, show: (view) => shown.push(view) });
        const second = { ...START, x: 300 };

        // Act
        animator.animateTo({ ...START, x: 100 });
        frames.tick(50);
        animator.animateTo(second);
        for (let frame = 0; frame < 5; frame++) { frames.tick(25); }

        // Assert
        assert.deepEqual(shown.at(-1), second);
    });

    test('stops where it is when cancelled', () => {
        // Arrange
        const frames = fakeFrames();
        const shown: ViewBox[] = [];
        const animator = createViewAnimator({ frames, durationMs: 100, current: () => shown.at(-1) ?? START, show: (view) => shown.push(view) });
        animator.animateTo({ ...START, x: 100 });
        frames.tick(50);
        const framesSoFar = shown.length;

        // Act
        animator.cancel();
        frames.tick(50);

        // Assert
        assert.equal(shown.length, framesSoFar);
        assert.equal(animator.maybeTarget(), null);
    });

    test('reports whether it is animating, for the page marker tests wait on', () => {
        // Arrange
        const frames = fakeFrames();
        const states: boolean[] = [];
        const animator = createViewAnimator({
            frames,
            durationMs: 50,
            current: () => START,
            show: () => undefined,
            onAnimatingChange: (animating) => states.push(animating),
        });

        // Act
        animator.animateTo({ ...START, x: 10 });
        frames.tick(25);
        frames.tick(25);

        // Assert
        assert.deepEqual(states, [true, false]);
    });
});
