import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { keyAction, type KeyEventLike } from '../../src/js/input/keyActions.ts';

const NO_MODIFIERS = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false };

function keyEvent(type: KeyEventLike['type'], key: string, code: string, modifiers: Partial<KeyEventLike> = {}): KeyEventLike {
    return { type, key, code, ...NO_MODIFIERS, ...modifiers };
}

const keyDown = (key: string, code: string, modifiers: Partial<KeyEventLike> = {}): KeyEventLike =>
    keyEvent('keydown', key, code, modifiers);

describe('keyAction: pointer-free zoom', () => {
    test('zooms in on Ctrl = as the key goes down', () => {
        assert.deepEqual(keyAction(keyDown('=', 'Equal', { ctrlKey: true })), { kind: 'zoomIn' });
    });

    test('zooms in on ⌘ =, the macOS shortcut', () => {
        assert.deepEqual(keyAction(keyDown('=', 'Equal', { metaKey: true })), { kind: 'zoomIn' });
    });

    test('zooms in on a plain +, typed as Shift =', () => {
        assert.deepEqual(keyAction(keyDown('+', 'Equal', { shiftKey: true })), { kind: 'zoomIn' });
    });

    test('zooms in on the numeric keypad +', () => {
        assert.deepEqual(keyAction(keyDown('+', 'NumpadAdd')), { kind: 'zoomIn' });
    });

    test('zooms out on -, with or without Ctrl', () => {
        // Act
        const actions = [keyDown('-', 'Minus'), keyDown('-', 'Minus', { ctrlKey: true })].map(keyAction);

        // Assert
        assert.deepEqual(actions, [{ kind: 'zoomOut' }, { kind: 'zoomOut' }]);
    });

    test('resets the view on 0, with or without ⌘', () => {
        // Act
        const actions = [keyDown('0', 'Digit0'), keyDown('0', 'Digit0', { metaKey: true })].map(keyAction);

        // Assert
        assert.deepEqual(actions, [{ kind: 'reset' }, { kind: 'reset' }]);
    });

    test('leaves zoom keys combined with Alt alone, since they type characters on macOS', () => {
        assert.equal(keyAction(keyDown('≠', 'Equal', { altKey: true })), null);
    });

    test('does nothing as a zoom key comes up, so a press never counts twice', () => {
        assert.equal(keyAction(keyEvent('keyup', '=', 'Equal', { ctrlKey: true })), null);
    });
});

describe('keyAction: arrow keys', () => {
    test('nudges the view right by a tenth on the right arrow', () => {
        assert.deepEqual(keyAction(keyDown('ArrowRight', 'ArrowRight')), { kind: 'nudge', dx: 0.1, dy: 0 });
    });

    test('nudges the view up by half on Shift + up arrow', () => {
        assert.deepEqual(keyAction(keyDown('ArrowUp', 'ArrowUp', { shiftKey: true })), { kind: 'nudge', dx: 0, dy: -0.5 });
    });

    test('leaves ⌘ + arrow alone, which is back and forward in the browser', () => {
        assert.equal(keyAction(keyDown('ArrowLeft', 'ArrowLeft', { metaKey: true })), null);
    });
});

describe('keyAction: other keys', () => {
    test('toggles full screen on F', () => {
        assert.deepEqual(keyAction(keyDown('f', 'KeyF')), { kind: 'toggleFullscreen' });
    });

    test('leaves ⌘ F alone, which is Find', () => {
        assert.equal(keyAction(keyDown('f', 'KeyF', { metaKey: true })), null);
    });

    test('toggles the shortcuts list on ?', () => {
        assert.deepEqual(keyAction(keyDown('?', 'Slash', { shiftKey: true })), { kind: 'toggleShortcuts' });
    });

    test('starts a pan when Space goes down', () => {
        assert.deepEqual(keyAction(keyDown(' ', 'Space')), { kind: 'panStart' });
    });

    test('ends a pan when Space comes up', () => {
        assert.deepEqual(keyAction(keyEvent('keyup', ' ', 'Space')), { kind: 'panEnd' });
    });

    test('resets the view when Escape comes up', () => {
        assert.deepEqual(keyAction(keyEvent('keyup', 'Escape', 'Escape')), { kind: 'reset' });
    });

    test('ignores Escape going down, acting only when it comes up', () => {
        assert.equal(keyAction(keyDown('Escape', 'Escape')), null);
    });

    test('zooms out when Alt is tapped', () => {
        assert.deepEqual(keyAction(keyEvent('keyup', 'Alt', 'AltLeft')), { kind: 'zoomOut' });
    });

    test('ignores a key with no binding', () => {
        assert.equal(keyAction(keyDown('a', 'KeyA')), null);
    });
});
