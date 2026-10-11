import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    exportBaseName,
    isExternalReference,
    pngFileName,
    pngSavedStatus,
    pngSize,
    svgFileName,
} from '../../src/js/export/exportPlan.ts';

describe('exportBaseName', () => {
    test('names exports after the SVG file, without its extension', () => {
        assert.equal(exportBaseName('https://example.com/maps/world.svg'), 'world');
    });

    test('decodes the file name', () => {
        assert.equal(exportBaseName('https://example.com/World%20Map.svg'), 'World Map');
    });

    test('ignores the query and the view link', () => {
        assert.equal(exportBaseName('https://example.com/plot.svg?v=2#svgView(viewBox(0,0,1,1))'), 'plot');
    });

    test('drops the extension whatever its case', () => {
        assert.equal(exportBaseName('file:///Users/me/plot.SVG'), 'plot');
    });

    test('keeps a name without an extension as it is', () => {
        assert.equal(exportBaseName('https://example.com/diagram'), 'diagram');
    });

    test('falls back to "drawing" when the path names no file', () => {
        assert.equal(exportBaseName('https://example.com/'), 'drawing');
    });

    test('falls back to "drawing" for a data URL', () => {
        assert.equal(exportBaseName('data:image/svg+xml,<svg/>'), 'drawing');
    });

    test('replaces characters that file names can\'t hold', () => {
        assert.equal(exportBaseName('https://example.com/a%2Fb%3Ac.svg'), 'a-b-c');
    });
});

describe('svgFileName', () => {
    test('adds the .svg extension', () => {
        assert.equal(svgFileName('world'), 'world.svg');
    });
});

describe('pngFileName', () => {
    test('names a 1× PNG after the drawing alone', () => {
        assert.equal(pngFileName('world', 1), 'world.png');
    });

    test('marks larger scales the way image assets usually are', () => {
        assert.equal(pngFileName('world', 2), 'world@2x.png');
    });
});

describe('pngSize', () => {
    test('scales the view\'s size on screen', () => {
        assert.deepEqual(pngSize({ width: 800, height: 600 }, 2), { width: 1600, height: 1200 });
    });

    test('rounds to whole pixels', () => {
        assert.deepEqual(pngSize({ width: 800.4, height: 600.6 }, 1), { width: 800, height: 601 });
    });

    test('is at least one pixel each way', () => {
        assert.deepEqual(pngSize({ width: 0, height: 0.2 }, 1), { width: 1, height: 1 });
    });
});

describe('isExternalReference', () => {
    test('is true for an image by URL', () => {
        assert.equal(isExternalReference('photo.png'), true);
    });

    test('is false for an embedded image', () => {
        assert.equal(isExternalReference('data:image/png;base64,AAAA'), false);
    });

    test('is false for a reference within the drawing', () => {
        assert.equal(isExternalReference('#gradient'), false);
    });

    test('is false for an empty reference', () => {
        assert.equal(isExternalReference('  '), false);
    });
});

describe('pngSavedStatus', () => {
    test('names the saved file', () => {
        assert.equal(pngSavedStatus('world@2x.png', 0), 'Saved world@2x.png');
    });

    test('says how many linked images were left out', () => {
        assert.equal(pngSavedStatus('world.png', 2), 'Saved world.png without 2 linked images that couldn\'t be loaded');
    });

    test('uses the singular for one image', () => {
        assert.equal(pngSavedStatus('world.png', 1), 'Saved world.png without 1 linked image that couldn\'t be loaded');
    });
});
