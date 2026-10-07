import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInfoModule, maybeCiRunUrl } from '../../scripts/buildInfo.ts';
import { formatBuildTime, provenanceFields, REPOSITORY_URL, UNAVAILABLE } from '../../src/shared/provenance.ts';

const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const RUN_URL = 'https://github.com/pRizz/SVG-Navigator---Chrome-Extension/actions/runs/42';
const TIMESTAMP = '2026-10-07T17:51:58.323Z';

describe('formatBuildTime', () => {
    test('shows the date and minute in UTC', () => {
        assert.equal(formatBuildTime(TIMESTAMP), '2026-10-07 17:51 UTC');
    });
});

describe('provenanceFields', () => {
    test('links a short commit hash to the full commit on GitHub', () => {
        // Act
        const [, commit] = provenanceFields('2.14', { timestamp: TIMESTAMP, maybeCommit: COMMIT, maybeRunUrl: null });

        // Assert
        assert.deepEqual(commit, { label: 'Commit', text: '0123456', maybeHref: `${REPOSITORY_URL}/commit/${COMMIT}` });
    });

    test('shows Unavailable for an unknown commit', () => {
        // Act
        const [, commit] = provenanceFields('2.14', { timestamp: TIMESTAMP, maybeCommit: null, maybeRunUrl: null });

        // Assert
        assert.deepEqual(commit, { label: 'Commit', text: UNAVAILABLE, maybeHref: null });
    });

    test('links the build time to the CI run that made it', () => {
        // Act
        const [, , built] = provenanceFields('2.14', { timestamp: TIMESTAMP, maybeCommit: null, maybeRunUrl: RUN_URL });

        // Assert
        assert.deepEqual(built, { label: 'Built', text: '2026-10-07 17:51 UTC', maybeHref: RUN_URL });
    });

    test('lists version, commit, and build in that order', () => {
        // Act
        const fields = provenanceFields('2.14', { timestamp: TIMESTAMP, maybeCommit: null, maybeRunUrl: null });

        // Assert
        assert.deepEqual(fields.map((field) => field.label), ['Version', 'Commit', 'Built']);
    });
});

describe('maybeCiRunUrl', () => {
    test('builds the run URL from the GitHub Actions variables', () => {
        // Arrange
        const env = { GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'pRizz/SVG-Navigator---Chrome-Extension', GITHUB_RUN_ID: '42' };

        // Act
        const maybeUrl = maybeCiRunUrl(env);

        // Assert
        assert.equal(maybeUrl, RUN_URL);
    });

    test('is null outside GitHub Actions', () => {
        assert.equal(maybeCiRunUrl({}), null);
    });
});

describe('buildInfoModule', () => {
    test('exports the build info as BUILD_INFO', () => {
        // Arrange
        const info = { timestamp: TIMESTAMP, maybeCommit: COMMIT, maybeRunUrl: null };

        // Act
        const source = buildInfoModule(info);

        // Assert
        const json = /export const BUILD_INFO: BuildInfo = (\{.*\});/s.exec(source)?.[1];
        assert.deepEqual(JSON.parse(json ?? 'null'), info);
    });
});
