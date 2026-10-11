import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    bandColors,
    bandForEscapeTime,
    bandPaths,
    maybeEscapeTime,
    rasterizeBands,
    renderMandelbrotSvg,
    type MandelbrotOptions,
} from '../../scripts/mandelbrot.ts';
import { PALETTES, PRESETS, parseMandelbrotArgs, type MandelbrotRender } from '../../scripts/mandelbrotOptions.ts';

const SMALL_OPTIONS: MandelbrotOptions = {
    width: 30,
    height: 20,
    centerRe: -0.75,
    centerIm: 0,
    span: 3,
    maxIterations: 100,
    paletteStops: ['#000000', '#ffffff'],
    bands: 8,
    cycle: 16,
    interiorColor: '#000000',
};

function onlyRender(args: string[]): MandelbrotRender {
    const command = parseMandelbrotArgs(args);
    assert.equal(command.kind, 'render');
    assert.equal(command.renders.length, 1);
    const [render] = command.renders;
    assert.ok(render);
    return render;
}

describe('maybeEscapeTime', () => {
    test('treats the origin as inside the set', () => {
        assert.equal(maybeEscapeTime(0, 0, 50), null);
    });

    test('treats a bounded point outside the shortcut regions as inside the set', () => {
        // -1.3 lies in the period-4 bulb, which the cardioid and period-2 checks miss.
        assert.equal(maybeEscapeTime(-1.3, 0, 500), null);
    });

    test('lets a far point escape after very few iterations', () => {
        // Act
        const maybeTime = maybeEscapeTime(2, 2, 50);

        // Assert
        assert.ok(maybeTime !== null && maybeTime < 3);
    });

    test('gives later-escaping points a larger escape time', () => {
        // Act
        const near = maybeEscapeTime(0.26, 0, 1000);
        const far = maybeEscapeTime(1, 0, 1000);

        // Assert
        assert.ok(near !== null && far !== null && near > far);
    });
});

describe('bandForEscapeTime', () => {
    test('walks the bands once per cycle', () => {
        assert.deepEqual([0, 4, 8, 12, 16].map((time) => bandForEscapeTime(time, 4, 16)), [0, 1, 2, 3, 0]);
    });

    test('wraps a slightly negative escape time to the last band', () => {
        assert.equal(bandForEscapeTime(-0.1, 4, 16), 3);
    });
});

describe('bandColors', () => {
    test('interpolates around the closed gradient', () => {
        assert.deepEqual(bandColors(['#000000', '#ffffff'], 4), ['#000000', '#808080', '#ffffff', '#808080']);
    });

    test('rejects a color that is not #rrggbb', () => {
        assert.throws(() => bandColors(['red'], 2), /#rrggbb/);
    });
});

describe('bandPaths', () => {
    test('merges a horizontal run of one band into a single rectangle', () => {
        // Arrange
        const raster = Int16Array.from([2, 2, 2, 5]);

        // Act
        const paths = bandPaths(raster, 4);

        // Assert
        assert.deepEqual(paths.get(2), ['M0 0h3v1h-3z']);
    });

    test('draws nothing for interior pixels', () => {
        // Arrange
        const raster = Int16Array.from([-1, -1, 0, -1]);

        // Act
        const paths = bandPaths(raster, 2);

        // Assert
        assert.deepEqual([...paths.entries()], [[0, ['M0 1h1v1h-1z']]]);
    });
});

describe('rasterizeBands', () => {
    test('puts the image center, inside the set, in the interior', () => {
        // Act
        const raster = rasterizeBands({ ...SMALL_OPTIONS, width: 3, height: 3, centerRe: 0, span: 0.1 });

        // Assert
        assert.equal(raster[4], -1);
    });

    test('is symmetric about the real axis when centered on it', () => {
        // Act
        const raster = rasterizeBands(SMALL_OPTIONS);

        // Assert
        const { width, height } = SMALL_OPTIONS;
        const firstRow = Array.from(raster.subarray(0, width));
        const lastRow = Array.from(raster.subarray((height - 1) * width));
        assert.deepEqual(firstRow, lastRow);
    });
});

describe('renderMandelbrotSvg', () => {
    test('draws at most one path per band, over an interior-colored background', () => {
        // Act
        const { svg, pathCount } = renderMandelbrotSvg(SMALL_OPTIONS, 'Test');

        // Assert
        assert.equal(svg.match(/<path /g)?.length, pathCount);
        assert.ok(pathCount <= SMALL_OPTIONS.bands);
        assert.match(svg, /<rect width="30" height="20" fill="#000000"\/>/);
    });

    test('sizes the viewBox to the sample grid', () => {
        // Act
        const { svg } = renderMandelbrotSvg(SMALL_OPTIONS, 'Test');

        // Assert
        assert.match(svg, /viewBox="0 0 30 20"/);
    });

    test('escapes the title', () => {
        // Act
        const { svg } = renderMandelbrotSvg(SMALL_OPTIONS, 'A <b> & c');

        // Assert
        assert.match(svg, /<title>A &lt;b&gt; &amp; c<\/title>/);
    });
});

describe('parseMandelbrotArgs', () => {
    test('defaults to the full preset', () => {
        // Act
        const render = onlyRender([]);

        // Assert
        assert.equal(render.name, 'full');
        assert.equal(render.options.span, PRESETS.full.span);
        assert.deepEqual(render.options.paletteStops, PALETTES.classic);
    });

    test('lets flags override a preset\'s view', () => {
        // Act
        const render = onlyRender(['--preset', 'seahorse', '--iterations', '50']);

        // Assert
        assert.equal(render.options.centerRe, PRESETS.seahorse.centerRe);
        assert.equal(render.options.maxIterations, 50);
    });

    test('names a changed view "custom" so it keeps the preset\'s file intact', () => {
        // Act
        const render = onlyRender(['--center=-0.5,0.25', '--span', '0.1']);

        // Assert
        assert.equal(render.name, 'custom');
        assert.equal(render.options.centerRe, -0.5);
        assert.equal(render.options.centerIm, 0.25);
    });

    test('renders every preset for --gallery', () => {
        // Act
        const command = parseMandelbrotArgs(['--gallery']);

        // Assert
        assert.ok(command.kind === 'render');
        assert.deepEqual(command.renders.map((render) => render.name), Object.keys(PRESETS));
    });

    test('rejects --gallery with --output', () => {
        assert.throws(() => parseMandelbrotArgs(['--gallery', '--output', 'x.svg']), /--gallery/);
    });

    test('rejects an unknown preset', () => {
        assert.throws(() => parseMandelbrotArgs(['--preset', 'nope']), /--preset must be one of/);
    });

    test('rejects a fractional width', () => {
        assert.throws(() => parseMandelbrotArgs(['--width', '10.5']), /--width expects a whole number/);
    });

    test('rejects a non-positive span', () => {
        assert.throws(() => parseMandelbrotArgs(['--span', '0']), /--span must be greater than 0/);
    });

    test('rejects a malformed center', () => {
        assert.throws(() => parseMandelbrotArgs(['--center', '1']), /--center expects <re>,<im>/);
    });

    test('returns help for --help', () => {
        assert.deepEqual(parseMandelbrotArgs(['--help']), { kind: 'help' });
    });
});
