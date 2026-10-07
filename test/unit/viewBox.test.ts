import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    fitToAspectRatio,
    formatViewBox,
    parseViewBox,
    wheelZoomFactor,
    zoomAroundCenter,
    zoomAroundPoint,
} from '../../src/js/viewBox.ts';

const FULL_SENSITIVITY = { sensitivity: 10, maxSensitivity: 10, invert: false };

describe('parseViewBox', () => {
    test('parses space-separated numbers', () => {
        // Act
        const viewBox = parseViewBox('-10 20.5 300 400');

        // Assert
        assert.deepEqual(viewBox, { x: -10, y: 20.5, width: 300, height: 400 });
    });

    test('accepts commas and mixed whitespace as separators', () => {
        // Act
        const viewBox = parseViewBox(' 0,0\t100 ,\n50 ');

        // Assert
        assert.deepEqual(viewBox, { x: 0, y: 0, width: 100, height: 50 });
    });

    test('returns NaN for missing numbers', () => {
        // Act
        const viewBox = parseViewBox('');

        // Assert
        assert.deepEqual(viewBox, { x: NaN, y: NaN, width: NaN, height: NaN });
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
