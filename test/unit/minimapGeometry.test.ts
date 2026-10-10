import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    drawingPointAt,
    minimapSize,
    outlineRect,
    showsWholeDrawing,
    viewCenteredOn,
} from '../../src/js/hud/minimapGeometry.ts';

const WHOLE = { x: 0, y: 0, width: 800, height: 600 };

describe('minimapSize', () => {
    test('fits the drawing\'s shape within 160 × 120', () => {
        assert.deepEqual(minimapSize({ x: 0, y: 0, width: 1600, height: 900 }), { width: 160, height: 90 });
    });

    test('limits a tall drawing by height', () => {
        assert.deepEqual(minimapSize({ x: 0, y: 0, width: 300, height: 600 }), { width: 60, height: 120 });
    });
});

describe('showsWholeDrawing', () => {
    test('is true at the original view', () => {
        assert.equal(showsWholeDrawing(WHOLE, WHOLE), true);
    });

    test('is false when zoomed in', () => {
        assert.equal(showsWholeDrawing({ x: 100, y: 100, width: 400, height: 300 }, WHOLE), false);
    });

    test('is false when panned so part of the drawing is off-screen', () => {
        assert.equal(showsWholeDrawing({ ...WHOLE, x: 50 }, WHOLE), false);
    });

    test('is true when zoomed out past the drawing', () => {
        assert.equal(showsWholeDrawing({ x: -400, y: -300, width: 1600, height: 1200 }, WHOLE), true);
    });
});

describe('outlineRect', () => {
    test('scales the view into minimap pixels', () => {
        // Act
        const rect = outlineRect({ x: 200, y: 150, width: 400, height: 300 }, WHOLE, { width: 160, height: 120 });

        // Assert
        assert.deepEqual(rect, { x: 40, y: 30, width: 80, height: 60 });
    });
});

describe('drawingPointAt', () => {
    test('maps a minimap pixel back to the drawing', () => {
        assert.deepEqual(drawingPointAt({ x: 40, y: 90 }, WHOLE, { width: 160, height: 120 }), { x: 200, y: 450 });
    });
});

describe('viewCenteredOn', () => {
    test('moves the view, keeping its size, so the point is in the middle', () => {
        assert.deepEqual(viewCenteredOn({ x: 0, y: 0, width: 200, height: 100 }, { x: 500, y: 400 }), { x: 400, y: 350, width: 200, height: 100 });
    });
});
