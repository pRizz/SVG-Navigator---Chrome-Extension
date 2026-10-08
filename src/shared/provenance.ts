/**
 * Which build is running: generated into `src/js/buildInfo.ts` by
 * `scripts/generateBuildInfo.ts`, and shown in the popup footer so a bug report
 * can name the exact build.
 */

export interface BuildInfo {
    /** When the build ran, as an ISO 8601 UTC timestamp. */
    timestamp: string;
    /** The full source commit; null when built outside a git checkout, such as from the store source archive. */
    maybeCommit: string | null;
    /** The CI run that made the build; null for local builds. */
    maybeRunUrl: string | null;
}

export const REPOSITORY_URL = 'https://github.com/pRizz/SVG-Navigator---Chrome-Extension';

/** Shown for any provenance field the build could not record. */
export const UNAVAILABLE = 'Unavailable';

/** How many characters of the commit hash to show. */
export const SHORT_COMMIT_LENGTH = 7;

export interface ProvenanceField {
    label: string;
    text: string;
    /** Where the text links to, when that is known. */
    maybeHref: string | null;
}

/** Formats an ISO timestamp as `YYYY-MM-DD HH:MM UTC`. */
export function formatBuildTime(isoTimestamp: string): string {
    return `${isoTimestamp.slice(0, 10)} ${isoTimestamp.slice(11, 16)} UTC`;
}

/** The version, short commit, and build time to show, linked where a URL is known. */
export function provenanceFields(version: string, info: BuildInfo): ProvenanceField[] {
    const commit: ProvenanceField = info.maybeCommit === null
        ? { label: 'Commit', text: UNAVAILABLE, maybeHref: null }
        : {
            label: 'Commit',
            text: info.maybeCommit.slice(0, SHORT_COMMIT_LENGTH),
            maybeHref: `${REPOSITORY_URL}/commit/${info.maybeCommit}`,
        };
    return [
        { label: 'Version', text: version, maybeHref: null },
        commit,
        { label: 'Built', text: formatBuildTime(info.timestamp), maybeHref: info.maybeRunUrl },
    ];
}
