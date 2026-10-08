import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    initialVisibility,
    isVisible,
    reduceVisibility,
    withAutoHide,
    type VisibilityEvent,
    type VisibilityState,
} from '../../src/js/hud/visibility.ts';

function after(state: VisibilityState, ...events: VisibilityEvent[]): VisibilityState {
    return events.reduce(reduceVisibility, state);
}

describe('HUD visibility', () => {
    test('is visible when mounted', () => {
        assert.equal(isVisible(initialVisibility(true)), true);
    });

    test('hides once the idle time passes', () => {
        // Act
        const state = after(initialVisibility(true), 'idleElapsed');

        // Assert
        assert.equal(isVisible(state), false);
    });

    test('wakes on activity', () => {
        // Act
        const state = after(initialVisibility(true), 'idleElapsed', 'activity');

        // Assert
        assert.equal(isVisible(state), true);
    });

    test('stays visible while the pointer is over it', () => {
        // Act
        const state = after(initialVisibility(true), 'pointerEnter', 'idleElapsed');

        // Assert
        assert.equal(isVisible(state), true);
    });

    test('hides when the pointer leaves after the idle time passed', () => {
        // Act
        const state = after(initialVisibility(true), 'pointerEnter', 'idleElapsed', 'pointerLeave');

        // Assert
        assert.equal(isVisible(state), false);
    });

    test('stays visible while keyboard focus is inside', () => {
        // Act
        const state = after(initialVisibility(true), 'focusIn', 'idleElapsed');

        // Assert
        assert.equal(isVisible(state), true);
    });

    test('stays visible while the shortcuts popover is open', () => {
        // Act
        const state = after(initialVisibility(true), 'popoverOpen', 'idleElapsed');

        // Assert
        assert.equal(isVisible(state), true);
    });

    test('never hides with auto-hide off', () => {
        // Act
        const state = after(initialVisibility(false), 'idleElapsed');

        // Assert
        assert.equal(isVisible(state), true);
    });

    test('turning auto-hide back on shows the HUD until the next idle spell', () => {
        // Act
        const state = withAutoHide(after(initialVisibility(true), 'idleElapsed'), true);

        // Assert
        assert.equal(isVisible(state), true);
    });
});
