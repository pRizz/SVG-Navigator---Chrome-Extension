import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { hudLayout } from '../../src/js/hud/layout.ts';
import { TOOLBAR_POSITIONS } from '../../src/shared/settings.ts';

/** `pick` of every position's layout, keyed by position. */
function layoutsBy<T>(pick: (position: typeof TOOLBAR_POSITIONS[number]) => T): Record<string, T> {
    return Object.fromEntries(TOOLBAR_POSITIONS.map((position) => [position, pick(position)]));
}

describe('hudLayout', () => {
    test('is vertical only on the left and right edges', () => {
        // Act
        const orientations = layoutsBy((position) => hudLayout(position).orientation);

        // Assert
        assert.deepEqual(orientations, {
            'top-left': 'horizontal', 'top': 'horizontal', 'top-right': 'horizontal',
            'left': 'vertical', 'right': 'vertical',
            'bottom-left': 'horizontal', 'bottom': 'horizontal', 'bottom-right': 'horizontal',
        });
    });

    test('opens the popover toward the window interior', () => {
        // Act
        const directions = layoutsBy((position) => hudLayout(position).popoverDirection);

        // Assert
        assert.deepEqual(directions, {
            'top-left': 'bottom', 'top': 'bottom', 'top-right': 'bottom',
            'left': 'right', 'right': 'left',
            'bottom-left': 'top', 'bottom': 'top', 'bottom-right': 'top',
        });
    });

    test('moves the debug card top-right only when the HUD is on the top-left, top, or left', () => {
        // Act
        const corners = layoutsBy((position) => hudLayout(position).debugCorner);

        // Assert
        assert.deepEqual(corners, {
            'top-left': 'top-right', 'top': 'top-right', 'top-right': 'top-left',
            'left': 'top-right', 'right': 'top-left',
            'bottom-left': 'top-left', 'bottom': 'top-left', 'bottom-right': 'top-left',
        });
    });

    test('puts the minimap in the bottom corner across from the pill', () => {
        // Act
        const corners = layoutsBy((position) => hudLayout(position).minimapCorner);

        // Assert
        assert.deepEqual(corners, {
            'top-left': 'bottom-right', 'top': 'bottom-left', 'top-right': 'bottom-left',
            'left': 'bottom-right', 'right': 'bottom-left',
            'bottom-left': 'bottom-right', 'bottom': 'bottom-left', 'bottom-right': 'bottom-left',
        });
    });
});
