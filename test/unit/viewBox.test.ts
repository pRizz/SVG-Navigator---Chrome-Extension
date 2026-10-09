import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    displayedZoom,
    fitToAspectRatio,
    formatViewBox,
    isRepresentableViewBox,
    lengthToPixels,
    maybeParseViewBox,
    panViewBox,
    rectFromCorners,
    wheelZoomFactor,
    zoomAroundCenter,
    zoomAroundPoint,
} from '../../src/js/viewBox.ts';

const FULL_SENSITIVITY = { sensitivity: 10, maxSensitivity: 10, invert: false };

describe('maybeParseViewBox', () => {
    test('parses space-separated numbers', () => {
        // Act
        const maybeViewBox = maybeParseViewBox('-10 20.5 300 400');

        // Assert
        assert.deepEqual(maybeViewBox, { x: -10, y: 20.5, width: 300, height: 400 });
    });

    test('accepts commas and mixed whitespace as separators', () => {
        // Act
        const maybeViewBox = maybeParseViewBox(' 0,0\t100 ,\n50 ');

        // Assert
        assert.deepEqual(maybeViewBox, { x: 0, y: 0, width: 100, height: 50 });
    });

    test('rejects an empty attribute', () => {
        assert.equal(maybeParseViewBox(''), null);
    });

    test('rejects the wrong number of values', () => {
        assert.equal(maybeParseViewBox('0 0 100 100 5'), null);
    });

    test('rejects a non-numeric value', () => {
        assert.equal(maybeParseViewBox('0 0 wide 100'), null);
    });

    test('rejects a width or height that is not positive', () => {
        assert.equal(maybeParseViewBox('0 0 0 100'), null);
    });
});

describe('rectFromCorners', () => {
    test('spans the corners whichever way the drag went', () => {
        // Act
        const rect = rectFromCorners({ x: 30, y: 5 }, { x: 10, y: 25 });

        // Assert
        assert.deepEqual(rect, { x: 10, y: 5, width: 20, height: 20 });
    });
});

describe('panViewBox', () => {
    test('moves the view so the grabbed point returns under the cursor', () => {
        // Arrange
        const viewBox = { x: 0, y: 0, width: 100, height: 100 };

        // Act
        const panned = panViewBox(viewBox, { x: 40, y: 40 }, { x: 50, y: 30 });

        // Assert
        assert.deepEqual(panned, { x: -10, y: 10, width: 100, height: 100 });
    });
});

describe('formatViewBox', () => {
    test('formats as space-separated x, y, width, height', () => {
        // Act
        const text = formatViewBox({ x: -1.5, y: 2, width: 30, height: 40 });

        // Assert
        assert.equal(text, '-1.5 2 30 40');
    });
});

describe('fitToAspectRatio', () => {
    test('widens a box that is too tall, keeping it centered', () => {
        // Act
        const fitted = fitToAspectRatio({ x: 0, y: 0, width: 100, height: 100 }, 2);

        // Assert
        assert.deepEqual(fitted, { x: -50, y: 0, width: 200, height: 100 });
    });

    test('heightens a box that is too wide, keeping it centered', () => {
        // Act
        const fitted = fitToAspectRatio({ x: 0, y: 0, width: 100, height: 100 }, 0.5);

        // Assert
        assert.deepEqual(fitted, { x: 0, y: -50, width: 100, height: 200 });
    });
});

describe('zoomAroundPoint', () => {
    test('scales the box while keeping the point at the same relative position', () => {
        // Arrange
        const viewBox = { x: 0, y: 0, width: 100, height: 100 };

        // Act
        const zoomed = zoomAroundPoint(viewBox, { x: 25, y: 50 }, 0.5);

        // Assert
        assert.deepEqual(zoomed, { x: 12.5, y: 25, width: 50, height: 50 });
    });
});

describe('zoomAroundCenter', () => {
    test('scales the box around its center', () => {
        // Act
        const zoomed = zoomAroundCenter({ x: 0, y: 0, width: 100, height: 50 }, 2);

        // Assert
        assert.deepEqual(zoomed, { x: -50, y: -25, width: 200, height: 100 });
    });
});

describe('wheelZoomFactor', () => {
    test('zooms in when scrolling up', () => {
        // Act
        const factor = wheelZoomFactor(-120, FULL_SENSITIVITY);

        // Assert
        assert.equal(factor, 1 / 2.01);
    });

    test('zooms out when scrolling down', () => {
        // Act
        const factor = wheelZoomFactor(120, FULL_SENSITIVITY);

        // Assert
        assert.equal(factor, 2.01);
    });

    test('reverses direction when inverted', () => {
        // Act
        const factor = wheelZoomFactor(-120, { ...FULL_SENSITIVITY, invert: true });

        // Assert
        assert.equal(factor, 2.01);
    });

    test('clamps deltas beyond one full wheel step', () => {
        // Act
        const factor = wheelZoomFactor(-100_000, FULL_SENSITIVITY);

        // Assert
        assert.equal(factor, wheelZoomFactor(-120, FULL_SENSITIVITY));
    });

    test('zooms less at lower sensitivity', () => {
        // Act
        const factor = wheelZoomFactor(-120, { ...FULL_SENSITIVITY, sensitivity: 5 });

        // Assert
        assert.equal(factor, 1 / 1.51);
    });
});

describe('displayedZoom', () => {
    const ORIGINAL = { x: 0, y: 0, width: 800, height: 600 };

    test('is 1 for the original view', () => {
        assert.equal(displayedZoom(ORIGINAL, ORIGINAL, 4 / 3), 1);
    });

    test('is 2 when the view is half as wide', () => {
        // Arrange
        const current = zoomAroundCenter(ORIGINAL, 0.5);

        // Act
        const zoom = displayedZoom(ORIGINAL, current, 4 / 3);

        // Assert
        assert.equal(zoom, 2);
    });

    test('measures a zoom box by its displayed size, not its raw width', () => {
        // Arrange: a tall box the browser letterboxes to 400 units wide in a 4:3 window
        const tallBox = { x: 0, y: 0, width: 100, height: 300 };

        // Act
        const zoom = displayedZoom(ORIGINAL, tallBox, 4 / 3);

        // Assert
        assert.equal(zoom, 2);
    });
});

describe('isRepresentableViewBox', () => {
    test('accepts an ordinary view', () => {
        assert.equal(isRepresentableViewBox({ x: -10, y: 20, width: 300, height: 200 }), true);
    });

    test('rejects a view that overflowed to Infinity', () => {
        assert.equal(isRepresentableViewBox({ x: -Infinity, y: 0, width: 1, height: 1 }), false);
    });

    test('rejects a view with a NaN coordinate', () => {
        assert.equal(isRepresentableViewBox({ x: 0, y: NaN, width: 1, height: 1 }), false);
    });

    test('rejects a view with no size', () => {
        assert.equal(isRepresentableViewBox({ x: 0, y: 0, width: 0, height: 10 }), false);
    });

    test('rejects a view too narrow to change its x coordinate', () => {
        // Arrange: at x = 400, a double can't tell 400 from 400 + 1e-14
        const tooNarrow = { x: 400, y: 0, width: 1e-14, height: 1 };

        // Act
        const isRepresentable = isRepresentableViewBox(tooNarrow);

        // Assert
        assert.equal(isRepresentable, false);
    });

    test('rejects a view too short to change its y coordinate', () => {
        assert.equal(isRepresentableViewBox({ x: 0, y: 1e20, width: 10, height: 1 }), false);
    });

    test('lets repeated zooming in stop at a representable view instead of breaking', () => {
        // Arrange
        let view = { x: 0, y: 0, width: 800, height: 600 };

        // Act: keep halving around an off-grid point until the next step is refused
        for (let step = 0; step < 2_000; step++) {
            const next = zoomAroundPoint(view, { x: 400.123, y: 300.456 }, 0.5);
            if (!isRepresentableViewBox(next)) { break; }
            view = next;
        }

        // Assert
        assert.ok([view.x, view.y, view.width, view.height].every(Number.isFinite), JSON.stringify(view));
        assert.ok(view.width > 0 && view.height > 0, JSON.stringify(view));
    });
});

describe('lengthToPixels', () => {
    test('reads a unitless length as pixels', () => {
        assert.equal(lengthToPixels('400', 1000), 400);
    });

    test('reads a percentage of the viewport', () => {
        assert.equal(lengthToPixels('50%', 800), 400);
    });

    test('converts absolute units to CSS pixels', () => {
        assert.equal(lengthToPixels('72pt', 800), 96);
    });

    test('uses the whole viewport when the length is missing', () => {
        assert.equal(lengthToPixels(null, 800), 800);
    });

    test('uses the whole viewport when the length is not a number', () => {
        assert.equal(lengthToPixels('auto', 800), 800);
    });
});
