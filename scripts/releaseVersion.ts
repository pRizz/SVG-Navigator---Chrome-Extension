/**
 * Why this run must not release `manifestVersion`, or null when it may. Only a tag
 * push is checked: its tag must be `v` plus the manifest version, so the stores get
 * exactly the version the tag names. Manual (dry) runs from a branch always pass.
 */
export function maybeReleaseTagError(manifestVersion: string, ref: string, refName: string): string | null {
    if (!ref.startsWith('refs/tags/')) {
        return null;
    }
    const expectedTag = `v${manifestVersion}`;
    if (refName === expectedTag) {
        return null;
    }
    return `Tag ${refName} does not match manifest version ${manifestVersion} (expected ${expectedTag})`;
}
