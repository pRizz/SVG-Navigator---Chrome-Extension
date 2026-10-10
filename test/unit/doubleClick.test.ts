import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { doubleClickZoomFactor, isDrag, shouldZoomOnDoubleClick } from '../../src/js/input/doubleClick.ts';

describe('isDrag', () => {
    test('treats a press and release a few pixels apart as a click', () => {
        assert.equal(isDrag({ x: 100, y: 100 }, { x: 102, y: 103 }), false);
    });

    test('treats a press and release far apart as a drag', () => {
        assert.equal(isDrag({ x: 100, y: 100 }, { x: 140, y: 100 }), true);
    });
});

describe('shouldZoomOnDoubleClick', () => {
    test('zooms when no drag has ended yet', () => {
        assert.equal(shouldZoomOnDoubleClick(10_000, null), true);
    });

    test('ignores a double-click right after a drag, which one of its clicks was', () => {
        assert.equal(shouldZoomOnDoubleClick(10_000, 9_800), false);
    });

    test('zooms when the last drag ended well before the double-click', () => {
        assert.equal(shouldZoomOnDoubleClick(10_000, 8_000), true);
    });
});

describe('doubleClickZoomFactor', () => {
    test('zooms in 2× on a plain double-click', () => {
        assert.equal(doubleClickZoomFactor(false), 0.5);
    });

    test('zooms out 2× with Shift held', () => {
        assert.equal(doubleClickZoomFactor(true), 2);
    });
});
