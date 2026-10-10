import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isPageState, isPageSwitchMessage, pageOffKey, pageSwitchView } from '../../src/shared/pageSwitch.ts';

describe('pageOffKey', () => {
    test('keys the page by its URL without the fragment, so view links share it', () => {
        assert.equal(pageOffKey('https://example.com/map.svg#svgView(viewBox(0,0,1,1))'), pageOffKey('https://example.com/map.svg'));
    });

    test('tells different pages apart', () => {
        assert.notEqual(pageOffKey('https://example.com/a.svg'), pageOffKey('https://example.com/b.svg'));
    });
});

describe('isPageSwitchMessage', () => {
    test('accepts a state request', () => {
        assert.equal(isPageSwitchMessage({ type: 'getPageState' }), true);
    });

    test('accepts a request to turn the navigator off', () => {
        assert.equal(isPageSwitchMessage({ type: 'setPageEnabled', enabled: false }), true);
    });

    test('rejects a request without a boolean', () => {
        assert.equal(isPageSwitchMessage({ type: 'setPageEnabled', enabled: 'no' }), false);
    });

    test('rejects anything else', () => {
        assert.equal(isPageSwitchMessage({ type: 'somethingElse' }), false);
    });
});

describe('pageSwitchView', () => {
    test('offers the switch, on, for a page the navigator runs on', () => {
        assert.deepEqual(pageSwitchView({ enabled: true, canToggle: true }), { checked: true, disabled: false, hint: 'Turn off to see the original SVG' });
    });

    test('offers the switch, off, for a page it was turned off on', () => {
        assert.deepEqual(pageSwitchView({ enabled: false, canToggle: true }), { checked: false, disabled: false, hint: 'Off for this page in this tab' });
    });

    test('explains when the site blocks the per-tab storage the switch needs', () => {
        // Act
        const view = pageSwitchView({ enabled: true, canToggle: false });

        // Assert
        assert.equal(view?.disabled, true);
        assert.match(view?.hint ?? '', /This site blocks/);
    });

    test('hides the switch when the tab is not an SVG the navigator runs on', () => {
        assert.equal(pageSwitchView(null), null);
    });
});

describe('isPageState', () => {
    test('accepts a content script\'s answer', () => {
        assert.equal(isPageState({ enabled: false, canToggle: true }), true);
    });

    test('rejects a malformed answer', () => {
        assert.equal(isPageState({ enabled: 'yes' }), false);
    });
});
