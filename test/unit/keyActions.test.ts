import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { keyAction, type KeyEventLike } from '../../src/js/input/keyActions.ts';

const NO_MODIFIERS = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false };

function keyEvent(type: KeyEventLike['type'], key: string, code: string, modifiers: Partial<KeyEventLike> = {}): KeyEventLike {
    return { type, key, code, ...NO_MODIFIERS, ...modifiers };
}

describe('keyAction', () => {
    test('starts a pan when Space goes down', () => {
        assert.equal(keyAction(keyEvent('keydown', ' ', 'Space')), 'panStart');
    });

    test('ends a pan when Space comes up', () => {
        assert.equal(keyAction(keyEvent('keyup', ' ', 'Space')), 'panEnd');
    });

    test('resets the view when Escape comes up', () => {
        assert.equal(keyAction(keyEvent('keyup', 'Escape', 'Escape')), 'reset');
    });

    test('zooms out when Alt is tapped', () => {
        assert.equal(keyAction(keyEvent('keyup', 'Alt', 'AltLeft')), 'zoomOut');
    });

    test('zooms in on Ctrl = by physical key, whatever character it types', () => {
        // Arrange: Firefox reports a different keyCode for this key than Chrome does
        const event = keyEvent('keyup', '+', 'Equal', { ctrlKey: true, shiftKey: true });

        // Act
        const action = keyAction(event);

        // Assert
        assert.equal(action, 'zoomIn');
    });

    test('zooms out on Ctrl -', () => {
        assert.equal(keyAction(keyEvent('keyup', '-', 'Minus', { ctrlKey: true })), 'zoomOut');
    });

    test('resets the view on Ctrl 0', () => {
        assert.equal(keyAction(keyEvent('keyup', '0', 'Digit0', { ctrlKey: true })), 'reset');
    });

    test('ignores = without Ctrl', () => {
        assert.equal(keyAction(keyEvent('keyup', '=', 'Equal')), null);
    });

    test('ignores a key with no binding', () => {
        assert.equal(keyAction(keyEvent('keydown', 'a', 'KeyA')), null);
    });

    test('ignores Escape going down, acting only when it comes up', () => {
        assert.equal(keyAction(keyEvent('keydown', 'Escape', 'Escape')), null);
    });
});
