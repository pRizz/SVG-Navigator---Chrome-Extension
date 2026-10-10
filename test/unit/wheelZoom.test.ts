import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { wheelZoomFactor, type WheelZoomSettings } from '../../src/js/input/wheelZoom.ts';

const PIXEL = 0;
const LINE = 1;
const PAGE = 2;

const DEFAULTS: WheelZoomSettings = { sensitivity: 7, maxSensitivity: 10, invert: false, pageHeight: 600 };

const scroll = (deltaY: number, deltaMode = PIXEL, settings = DEFAULTS): number =>
    wheelZoomFactor({ deltaY, deltaMode, ctrlKey: false }, settings);

describe('wheelZoomFactor', () => {
    test('zooms in when scrolling up', () => {
        assert.ok(scroll(-100) < 1);
    });

    test('zooms out when scrolling down', () => {
        assert.ok(scroll(100) > 1);
    });

    test('keeps the mouse-wheel feel: a 100 px notch at the default sensitivity zooms in about 1.59×', () => {
        // Act
        const factor = scroll(-100);

        // Assert: 0.628 is what the previous formula gave for this notch
        assert.ok(Math.abs(factor - 0.628) < 0.003, `factor ${factor}`);
    });

    test('adds up many small trackpad deltas to the zoom of one delta of their sum', () => {
        // Act
        const fiftySmall = Array.from({ length: 50 }, () => scroll(-2)).reduce((product, factor) => product * factor, 1);

        // Assert
        assert.ok(Math.abs(fiftySmall - scroll(-100)) < 1e-12, `${fiftySmall} vs ${scroll(-100)}`);
    });

    test('reads a line-mode delta (Firefox mouse wheels) as 40 px a line', () => {
        assert.equal(scroll(-3, LINE), scroll(-120));
    });

    test('reads a page-mode delta as the window height', () => {
        assert.equal(scroll(-0.1, PAGE), scroll(-60));
    });

    test('reverses direction when inverted', () => {
        assert.ok(scroll(-100, PIXEL, { ...DEFAULTS, invert: true }) > 1);
    });

    test('zooms less at lower sensitivity', () => {
        assert.ok(scroll(-100, PIXEL, { ...DEFAULTS, sensitivity: 2 }) > scroll(-100));
    });

    test('never zooms more than 2× in one event', () => {
        assert.equal(scroll(-100_000), 0.5);
    });

    test('zooms a pinch (Ctrl + wheel) at its own rate, ignoring sensitivity and invert', () => {
        // Act
        const pinch = (settings: WheelZoomSettings): number => wheelZoomFactor({ deltaY: -10, deltaMode: PIXEL, ctrlKey: true }, settings);

        // Assert
        assert.equal(pinch(DEFAULTS), Math.exp(-0.1));
        assert.equal(pinch({ ...DEFAULTS, sensitivity: 1, invert: true }), Math.exp(-0.1));
    });
});
