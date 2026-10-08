import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, TOOLBAR_POSITIONS, parseSetting, parseSettings } from '../../src/shared/settings.ts';

describe('parseSettings', () => {
    test('uses the defaults when nothing is stored', () => {
        // Act
        const settings = parseSettings({});

        // Assert
        assert.deepEqual(settings, DEFAULT_SETTINGS);
    });

    test('prefers stored values over the defaults', () => {
        // Arrange
        const stored = { scrollSensitivity: 2.5, toolbarEnabled: false, clickAndDragBehavior: 'zoomBox' };

        // Act
        const settings = parseSettings(stored);

        // Assert
        assert.deepEqual(settings, { ...DEFAULT_SETTINGS, ...stored });
    });

    test('falls back to the default for a stored value of the wrong type', () => {
        // Act
        const settings = parseSettings({ scrollSensitivity: 'fast', invertScroll: 'yes', clickAndDragBehavior: 'spin' });

        // Assert
        assert.deepEqual(settings, DEFAULT_SETTINGS);
    });

    test('ignores keys that are not settings', () => {
        // Act
        const settings = parseSettings({ unrelated: 1 });

        // Assert
        assert.deepEqual(settings, DEFAULT_SETTINGS);
    });
});

describe('parseSetting', () => {
    test('falls back to the default for a removed value', () => {
        // Act
        const color = parseSetting('svgBackgroundColor', undefined);

        // Assert
        assert.equal(color, 'white');
    });
});

describe('toolbarPosition', () => {
    test('defaults to the bottom-right corner', () => {
        assert.equal(parseSettings({}).toolbarPosition, 'bottom-right');
    });

    test('accepts every position the picker offers', () => {
        // Act
        const parsed = TOOLBAR_POSITIONS.map((position) => parseSetting('toolbarPosition', position));

        // Assert
        assert.deepEqual(parsed, [...TOOLBAR_POSITIONS]);
    });

    test('falls back to the default for an unknown position', () => {
        assert.equal(parseSetting('toolbarPosition', 'center'), 'bottom-right');
    });
});
