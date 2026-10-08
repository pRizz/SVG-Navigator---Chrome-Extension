import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    CHECKERBOARD_BACKGROUND,
    DARK_BACKGROUND,
    backgroundButtonTitle,
    backgroundCss,
    nextBackground,
} from '../../src/js/hud/backgroundCycle.ts';

describe('nextBackground', () => {
    test('cycles saved, checkerboard, dark, and back to saved', () => {
        // Act
        const sequence = [nextBackground('saved'), nextBackground('checkerboard'), nextBackground('dark')];

        // Assert
        assert.deepEqual(sequence, ['checkerboard', 'dark', 'saved']);
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
        assert.equal(backgroundButtonTitle('dark'), 'Background: saved color');
    });
});
