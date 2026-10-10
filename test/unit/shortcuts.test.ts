import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { shortcutRows, shortcutText, type ShortcutRow } from '../../src/shared/shortcuts.ts';

/** The plain-text keys listed for `action`. */
function keysFor(rows: readonly ShortcutRow[], action: string): string | undefined {
    const maybeRow = rows.find((row) => row.action === action);
    return maybeRow && shortcutText(maybeRow);
}

describe('shortcutRows', () => {
    test('lists drag as a pan in pan mode', () => {
        assert.equal(keysFor(shortcutRows('pan', false), 'Pan'), 'Drag, or hold Space and move');
    });

    test('lists drag as a zoom box in zoom box mode', () => {
        assert.equal(keysFor(shortcutRows('zoomBox', false), 'Zoom to an area'), 'Drag');
    });

    test('still lists Space panning in zoom box mode', () => {
        assert.equal(keysFor(shortcutRows('zoomBox', false), 'Pan'), 'Hold Space and move');
    });

    test('lists both drag behaviors when either may be set', () => {
        // Act
        const rows = shortcutRows('either', false);

        // Assert
        assert.equal(keysFor(rows, 'Pan'), 'Drag (pan mode), or hold Space and move');
        assert.equal(keysFor(rows, 'Zoom to an area'), 'Drag (zoom box mode)');
    });

    test('calls Alt Option on macOS', () => {
        assert.equal(keysFor(shortcutRows('pan', true), 'Zoom out'), 'Tap Option');
    });

    test('keeps the Alt label off macOS', () => {
        assert.equal(keysFor(shortcutRows('pan', false), 'Zoom out'), 'Tap Alt');
    });

    test('lists the keyboard zoom and reset keys', () => {
        // Act
        const rows = shortcutRows('pan', false);

        // Assert
        assert.equal(keysFor(rows, 'Zoom in / out'), '+ / −, also with Ctrl');
        assert.equal(keysFor(rows, 'Reset view'), 'Esc or 0');
    });

    test('names ⌘ for the keyboard zoom on macOS', () => {
        assert.equal(keysFor(shortcutRows('pan', true), 'Zoom in / out'), '+ / −, also with ⌘');
    });

    test('lists arrow-key panning, full screen, and the shortcuts key', () => {
        // Act
        const rows = shortcutRows('pan', false);

        // Assert
        assert.equal(keysFor(rows, 'Move the view'), '← ↑ → ↓, with Shift for bigger steps');
        assert.equal(keysFor(rows, 'Full screen'), 'F');
        assert.equal(keysFor(rows, 'Show these shortcuts'), '?');
    });

    test('lists double-click zoom, with Shift to zoom out', () => {
        assert.equal(keysFor(shortcutRows('pan', false), 'Zoom in at a spot'), 'Double-click, or Shift + Double-click to zoom out');
    });

    test('marks keys and gestures as key caps, separate from connecting text', () => {
        // Act
        const maybeRow = shortcutRows('pan', false).find((row) => row.action === 'Reset view');

        // Assert
        assert.deepEqual(maybeRow?.parts, [{ key: 'Esc' }, ' or ', { key: '0' }]);
    });
});
