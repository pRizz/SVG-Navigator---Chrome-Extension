import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { maybeReleaseTagError } from '../../scripts/releaseVersion.ts';

describe('maybeReleaseTagError', () => {
    test('accepts a tag that matches the manifest version', () => {
        assert.equal(maybeReleaseTagError('2.14', 'refs/tags/v2.14', 'v2.14'), null);
    });

    test('rejects a tag that names a different version', () => {
        // Act
        const maybeError = maybeReleaseTagError('2.14', 'refs/tags/v2.13', 'v2.13');

        // Assert
        assert.equal(maybeError, 'Tag v2.13 does not match manifest version 2.14 (expected v2.14)');
    });

    test('does not check a manual run from a branch', () => {
        assert.equal(maybeReleaseTagError('2.14', 'refs/heads/master', 'master'), null);
    });
});
