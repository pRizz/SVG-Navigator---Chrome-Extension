import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { safariVersionXcconfig } from '../../scripts/safariVersion.ts';

describe('safariVersionXcconfig', () => {
    test('uses the manifest version as the app version and build number', () => {
        // Act
        const xcconfig = safariVersionXcconfig('2.13');

        // Assert
        assert.match(xcconfig, /^MARKETING_VERSION = 2\.13$/m);
        assert.match(xcconfig, /^CURRENT_PROJECT_VERSION = 2\.13$/m);
    });

    test('rejects a four-part version, which the App Store does not accept', () => {
        assert.throws(() => safariVersionXcconfig('2.13.0.1'), /not valid for the App Store/);
    });

    test('rejects a version with non-numeric parts', () => {
        assert.throws(() => safariVersionXcconfig('2.13-beta'), /not valid for the App Store/);
    });
});
