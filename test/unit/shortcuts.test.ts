import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { shortcutRows } from '../../src/js/hud/shortcuts.ts';

/** The keys listed for `action`. */
function keysFor(rows: ReturnType<typeof shortcutRows>, action: string): string | undefined {
    return rows.find(([rowAction]) => rowAction === action)?.[1];
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

    test('calls Alt Option on macOS', () => {
        assert.equal(keysFor(shortcutRows('pan', true), 'Zoom out'), 'Tap Option');
    });

    test('calls Alt Alt elsewhere', () => {
        assert.equal(keysFor(shortcutRows('pan', false), 'Zoom out'), 'Tap Alt');
    });
});
