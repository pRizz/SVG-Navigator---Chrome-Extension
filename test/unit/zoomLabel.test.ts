import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { zoomLabel } from '../../src/js/hud/zoomLabel.ts';

describe('zoomLabel', () => {
    test('shows the original view as 100%', () => {
        assert.equal(zoomLabel(1), '100%');
    });

    test('rounds to a whole percent', () => {
        assert.equal(zoomLabel(3.4012), '340%');
    });

    test('shows a zoomed-out view as a whole percent', () => {
        assert.equal(zoomLabel(0.25), '25%');
    });

    test('keeps two significant figures below 1%', () => {
        assert.equal(zoomLabel(0.005), '0.5%');
    });

    test('switches to compact notation at 10,000%', () => {
        assert.equal(zoomLabel(100), '10K%');
    });

    test('switches to compact notation when rounding reaches 10,000%', () => {
        assert.equal(zoomLabel(99.996), '10K%');
    });

    test('uses compact notation for thousands', () => {
        assert.equal(zoomLabel(120), '12K%');
    });

    test('uses compact notation for millions', () => {
        assert.equal(zoomLabel(34_000), '3.4M%');
    });

    test('uses an exponent beyond compact notation', () => {
        assert.equal(zoomLabel(1.2e18), '1.2e20%');
    });

    test('shows a zoom too deep to represent as infinite', () => {
        assert.equal(zoomLabel(Infinity), '∞%');
    });

    test('shows a dash when the zoom is undefined', () => {
        assert.equal(zoomLabel(NaN), '—');
    });
});
