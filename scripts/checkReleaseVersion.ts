/**
 * Release workflow step: publishes the manifest version as the step output
 * `version`, and fails a tag push whose tag does not match it.
 *
 * Run with `bun scripts/checkReleaseVersion.ts` inside GitHub Actions.
 */

import { appendFileSync, readFileSync } from 'node:fs';
import { maybeReleaseTagError } from './releaseVersion.ts';

function requireEnv(name: string): string {
    const maybeValue = process.env[name];
    if (maybeValue === undefined) {
        throw new Error(`Missing environment variable ${name}; run this inside GitHub Actions`);
    }
    return maybeValue;
}

const manifest = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8')) as { version: string };
console.log(`Manifest version: ${manifest.version}`);
appendFileSync(requireEnv('GITHUB_OUTPUT'), `version=${manifest.version}\n`);

const maybeError = maybeReleaseTagError(manifest.version, requireEnv('GITHUB_REF'), requireEnv('GITHUB_REF_NAME'));
if (maybeError !== null) {
    console.error(`::error::${maybeError}`);
    process.exit(1);
}
console.log('Release version check passed');
