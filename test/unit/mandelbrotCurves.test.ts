import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { MandelbrotOptions } from '../../scripts/mandelbrot.ts';
import { curveLayers, fillInterior, limitSlope, smoothLoopPath, withoutRedundantPoints } from '../../scripts/mandelbrotCurves.ts';

const SMALL_OPTIONS: MandelbrotOptions = {
    style: 'curves',
    width: 30,
    height: 20,
    centerRe: -0.75,
    centerIm: 0,
    span: 3,
    maxIterations: 100,
    paletteStops: ['#000000', '#ffffff'],
    bands: 8,
    cycle: 16,
    interiorColor: '#123456',
    curveDetail: 4,
};

describe('fillInterior', () => {
    test('gives an interior sample the value of its escaping neighbor', () => {
        // Act
        const filled = fillInterior(Float64Array.from([5, NaN, NaN]), 3, 1);

        // Assert
        assert.deepEqual(Array.from(filled), [5, 5, 5]);
    });

    test('fills a view entirely inside the set with zeros', () => {
        assert.deepEqual(Array.from(fillInterior(Float64Array.from([NaN, NaN]), 2, 1)), [0, 0]);
    });
});

describe('limitSlope', () => {
    test('lowers a spike to its neighbors plus the allowed rise', () => {
        // Act
        const limited = limitSlope(Float64Array.from([1, 50, 1]), 3, 1, 2);

        // Assert
        assert.deepEqual(Array.from(limited), [1, 3, 1]);
    });

    test('leaves a gentle slope unchanged', () => {
        assert.deepEqual(Array.from(limitSlope(Float64Array.from([1, 2, 3]), 3, 1, 2)), [1, 2, 3]);
    });
});

describe('withoutRedundantPoints', () => {
    test('drops a point on the straight line between its neighbors', () => {
        // Act
        const kept = withoutRedundantPoints([[0, 0], [1, 0], [2, 0], [2, 2], [0, 2]]);

        // Assert
        assert.deepEqual(kept, [[0, 0], [2, 0], [2, 2], [0, 2]]);
    });
});

describe('smoothLoopPath', () => {
    test('curves through the sides\' midpoints with relative quadratic segments', () => {
        // Act
        const path = smoothLoopPath([[2, 2], [4, 2], [4, 4], [2, 4]], 10, 10);

        // Assert
        assert.equal(path, 'M2 3q0-1 1-1q1 0 1 1q0 1-1 1q-1 0-1-1z');
    });

    test('keeps a point on the image\'s border as a sharp corner', () => {
        // Act
        const path = smoothLoopPath([[0, 0], [4, 0], [4, 4], [0, 4]], 4, 4);

        // Assert
        assert.equal(path, 'M0 2l0-2l2 0l2 0l0 2l0 2l-2 0l-2 0l0-2z');
    });

    test('writes fractions without a leading zero or a needless separator', () => {
        assert.equal(smoothLoopPath([[1, 1], [1.5, 1], [1.5, 1.5]], 10, 10), 'M1.25 1.25q-.25-.25 0-.25q.25 0 .25.25q0 .25-.25 0z');
    });
});

describe('curveLayers', () => {
    test('draws the set last, in the interior color', () => {
        // Act
        const { paths } = curveLayers(SMALL_OPTIONS);

        // Assert
        assert.match(paths[paths.length - 1] ?? '', /^<path fill="#123456"/);
    });

    test('covers a view entirely inside the set with the interior alone', () => {
        // Act
        const { paths } = curveLayers({ ...SMALL_OPTIONS, centerRe: 0, span: 0.01 });

        // Assert
        assert.deepEqual(paths, ['<path fill="#123456" d="M0 10l0-10l15 0l15 0l0 10l0 10l-15 0l-15 0l0-10z"/>']);
    });

    test('closes every loop', () => {
        // Act
        const { paths, loopCount } = curveLayers(SMALL_OPTIONS);

        // Assert
        assert.equal(paths.join('').match(/z/g)?.length, loopCount);
    });
});
