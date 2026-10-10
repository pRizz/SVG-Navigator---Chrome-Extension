import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    CHECKERBOARD_BACKGROUND,
    DARK_BACKGROUND,
    INVERT_FILTER,
    backgroundButtonTitle,
    backgroundCss,
    drawingFilter,
    nextBackground,
} from '../../src/js/hud/backgroundCycle.ts';

describe('nextBackground', () => {
    test('cycles saved, checkerboard, dark, inverted, and back to saved', () => {
        // Act
        const sequence = (['saved', 'checkerboard', 'dark', 'inverted'] as const).map(nextBackground);

        // Assert
        assert.deepEqual(sequence, ['checkerboard', 'dark', 'inverted', 'saved']);
    });
});

describe('backgroundCss', () => {
    test('uses the saved color for the saved state', () => {
        assert.equal(backgroundCss('saved', 'rgb(1, 2, 3)'), 'rgb(1, 2, 3)');
    });

    test('uses the checkerboard pattern for the checkerboard state', () => {
        assert.equal(backgroundCss('checkerboard', 'white'), CHECKERBOARD_BACKGROUND);
    });

    test('uses the dark color for the dark state', () => {
        assert.equal(backgroundCss('dark', 'white'), DARK_BACKGROUND);
    });
});

describe('backgroundButtonTitle', () => {
    test('names the background a click switches to', () => {
        assert.equal(backgroundButtonTitle('inverted'), 'Background: saved color');
    });
});

describe('drawingFilter', () => {
    test('inverts the drawing, keeping hues, in the inverted state', () => {
        assert.equal(drawingFilter('inverted'), INVERT_FILTER);
    });

    test('leaves the drawing alone in every other state', () => {
        // Act
        const filters = (['saved', 'checkerboard', 'dark'] as const).map(drawingFilter);

        // Assert
        assert.deepEqual(filters, ['', '', '']);
    });
});

describe('inverted background', () => {
    test('puts the inverted drawing on the dark background', () => {
        assert.equal(backgroundCss('inverted', 'white'), DARK_BACKGROUND);
    });

    test('is what the dark state\'s button offers next', () => {
        assert.equal(backgroundButtonTitle('dark'), 'Background: inverted drawing');
    });
});
