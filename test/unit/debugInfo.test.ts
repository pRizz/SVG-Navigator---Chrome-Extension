import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    debugSections,
    debugText,
    describeBrowser,
    describeElement,
    formatNumber,
    type DebugInfo,
} from '../../src/js/hud/debugInfo.ts';

const SAMPLE: DebugInfo = {
    viewBox: { x: 12.345678, y: -0.000001, width: 800, height: 600 },
    zoomRatio: 2,
    pointer: { client: { x: 100.4, y: 50.6 }, svg: { x: 10.123456, y: 20 }, maybeElement: null },
    document: {
        viewBox: { x: 0, y: 0, width: 400, height: 300 },
        viewBoxSource: 'derivedFromSize',
        authoredWidth: '400',
        authoredHeight: '300',
        authoredPreserveAspectRatio: null,
        elementCount: 2,
    },
    input: { interaction: 'idle', maybeLastWheel: null, clickAndDragBehavior: 'pan', scrollSensitivity: 7, invertScroll: false },
    environment: { browser: 'Firefox 140.0', devicePixelRatio: 2, windowWidth: 800, windowHeight: 600 },
    build: { version: '2.14', maybeCommit: '0123456789abcdef', timestamp: '2026-10-07T18:21:11.089Z' },
};

/** The value of `name` in the section titled `title`. */
function row(info: DebugInfo, title: string, name: string): string | undefined {
    return debugSections(info).find((section) => section.title === title)?.rows.find(([rowName]) => rowName === name)?.[1];
}

describe('formatNumber', () => {
    test('rounds to four significant figures', () => {
        assert.equal(formatNumber(12.345678), '12.35');
    });

    test('shows negative zero as 0', () => {
        assert.equal(formatNumber(-0.00000001 * 0), '0');
    });

    test('keeps large numbers whole', () => {
        assert.equal(formatNumber(123456), '123500');
    });
});

describe('describeElement', () => {
    test('joins the tag, id, and classes like a CSS selector', () => {
        assert.equal(describeElement({ localName: 'path', id: 'coast', classNames: ['border', 'eu'] }), 'path#coast.border.eu');
    });

    test('omits a missing id', () => {
        assert.equal(describeElement({ localName: 'g', id: '', classNames: ['layer'] }), 'g.layer');
    });

    test('truncates long labels to 48 characters', () => {
        // Act
        const label = describeElement({ localName: 'path', id: 'x'.repeat(60), classNames: [] });

        // Assert
        assert.equal(label.length, 48);
        assert.ok(label.endsWith('…'));
    });
});

describe('describeBrowser', () => {
    const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

    test('prefers the named brand from client hints', () => {
        // Arrange
        const brands = [{ brand: 'Not)A;Brand', version: '8' }, { brand: 'Chromium', version: '140' }, { brand: 'Google Chrome', version: '140' }];

        // Act
        const browser = describeBrowser(CHROME_UA, brands);

        // Assert
        assert.equal(browser, 'Google Chrome 140');
    });

    test('reads Firefox from the user agent', () => {
        assert.equal(describeBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0', null), 'Firefox 140.0');
    });

    test('reads Edge before Chrome from the user agent', () => {
        assert.equal(describeBrowser(`${CHROME_UA} Edg/140.0.3485.54`, null), 'Microsoft Edge 140.0.3485.54');
    });

    test('reads Chrome from the user agent', () => {
        assert.equal(describeBrowser(CHROME_UA, null), 'Chrome 140.0.0.0');
    });

    test('reads Safari from the user agent', () => {
        assert.equal(describeBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', null), 'Safari 26.0');
    });

    test('falls back to Unknown', () => {
        assert.equal(describeBrowser('curl/8.0', null), 'Unknown');
    });
});

describe('debugSections', () => {
    test('labels a viewBox the navigator made from the size', () => {
        assert.equal(row(SAMPLE, 'Document', 'viewBox'), '0 0 400 300 (derived from size)');
    });

    test('shows the short commit', () => {
        assert.equal(row(SAMPLE, 'Build', 'Commit'), '0123456');
    });

    test('shows Unavailable for a build without a commit', () => {
        // Arrange
        const info = { ...SAMPLE, build: { ...SAMPLE.build, maybeCommit: null } };

        // Act
        const commit = row(info, 'Build', 'Commit');

        // Assert
        assert.equal(commit, 'Unavailable');
    });

    test('names the wheel delta mode', () => {
        // Arrange
        const info = { ...SAMPLE, input: { ...SAMPLE.input, maybeLastWheel: { deltaY: -120, deltaMode: 1 } } };

        // Act
        const wheel = row(info, 'Input', 'Last wheel');

        // Assert
        assert.equal(wheel, 'deltaY -120 (line)');
    });

    test('shows the zoom with the HUD label', () => {
        assert.equal(row(SAMPLE, 'View', 'Zoom'), '200%');
    });
});

describe('debugText', () => {
    test('writes one heading per section and name: value lines, separated by blank lines', () => {
        // Arrange
        const sections = [
            { title: 'View', rows: [['X', '1'], ['Y', '2']] as const },
            { title: 'Build', rows: [['Version', '2.14']] as const },
        ];

        // Act
        const text = debugText(sections);

        // Assert
        assert.equal(text, 'View\nX: 1\nY: 2\n\nBuild\nVersion: 2.14');
    });
});
