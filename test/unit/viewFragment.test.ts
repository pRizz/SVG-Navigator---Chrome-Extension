import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSvgViewFragment, maybeParseSvgViewFragment, ownsFragment } from '../../src/js/viewFragment.ts';

describe('maybeParseSvgViewFragment', () => {
    test('reads the viewBox from an svgView fragment', () => {
        assert.deepEqual(maybeParseSvgViewFragment('#svgView(viewBox(0,10,100,50))'), { x: 0, y: 10, width: 100, height: 50 });
    });

    test('reads a percent-encoded fragment, as some browsers report it', () => {
        assert.deepEqual(maybeParseSvgViewFragment('#svgView(viewBox(10%2C20%2C30%2C40))'), { x: 10, y: 20, width: 30, height: 40 });
    });

    test('reads the viewBox when other view parameters follow it', () => {
        // Act
        const maybeView = maybeParseSvgViewFragment('#svgView(viewBox(1 2 3 4);preserveAspectRatio(none))');

        // Assert
        assert.deepEqual(maybeView, { x: 1, y: 2, width: 3, height: 4 });
    });

    test('ignores an ordinary fragment', () => {
        assert.equal(maybeParseSvgViewFragment('#layer1'), null);
    });

    test('ignores an empty fragment', () => {
        assert.equal(maybeParseSvgViewFragment(''), null);
    });

    test('ignores a view with no size', () => {
        assert.equal(maybeParseSvgViewFragment('#svgView(viewBox(0,0,0,10))'), null);
    });

    test('ignores a fragment that is not valid percent-encoding', () => {
        assert.equal(maybeParseSvgViewFragment('#svgView(viewBox(%E0%A4%A))'), null);
    });
});

describe('formatSvgViewFragment', () => {
    test('writes the standard svgView syntax', () => {
        assert.equal(formatSvgViewFragment({ x: 0, y: 0, width: 800, height: 600 }), '#svgView(viewBox(0,0,800,600))');
    });

    test('rounds to about a ten-thousandth of the view, keeping links short', () => {
        assert.equal(formatSvgViewFragment({ x: 12.3456789, y: 1.23456789, width: 100, height: 100 }), '#svgView(viewBox(12.35,1.23,100,100))');
    });

    test('keeps a deep-zoom view precise enough to reopen it', () => {
        // Arrange
        const view = { x: 400.123456789012, y: 300.987654321098, width: 1e-6, height: 7.5e-7 };

        // Act
        const maybeRoundTrip = maybeParseSvgViewFragment(formatSvgViewFragment(view));

        // Assert
        assert.ok(maybeRoundTrip, 'fragment should parse');
        assert.ok(Math.abs(maybeRoundTrip.x - view.x) < view.width / 1000, `x ${maybeRoundTrip.x} vs ${view.x}`);
        assert.ok(Math.abs(maybeRoundTrip.y - view.y) < view.height / 1000, `y ${maybeRoundTrip.y} vs ${view.y}`);
    });
});

describe('ownsFragment', () => {
    test('owns a URL without a fragment', () => {
        assert.equal(ownsFragment(''), true);
    });

    test('owns its own svgView fragment', () => {
        assert.equal(ownsFragment('#svgView(viewBox(0,0,1,1))'), true);
    });

    test('owns a malformed svgView fragment, so it gets corrected', () => {
        assert.equal(ownsFragment('#svgView(viewBox(oops))'), true);
    });

    test('leaves the SVG\'s own fragment identifiers alone', () => {
        assert.equal(ownsFragment('#layer1'), false);
    });
});
