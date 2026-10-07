import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildInfoModule, maybeCiRunUrl } from './buildInfo.ts';
import { safariVersionXcconfig } from './safariVersion.ts';

const repoRoot = realpathSync(fileURLToPath(new URL('../', import.meta.url)));

/**
 * The commit being built, or null outside this repository's own git checkout. The
 * store source archive has no `.git`, and must not pick up the commit of some
 * enclosing repository it was unpacked into.
 */
function maybeSourceCommit(): string | null {
    let output: string;
    try {
        output = execFileSync('git', ['rev-parse', '--show-toplevel', 'HEAD'], {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
    } catch (error) {
        console.warn(`generateBuildInfo: no git commit recorded (${error instanceof Error ? error.message.split('\n')[0] : String(error)})`);
        return null;
    }
    const [maybeTopLevel, maybeCommit] = output.trim().split('\n');
    if (maybeTopLevel === undefined || realpathSync(maybeTopLevel) !== repoRoot) {
        console.warn('generateBuildInfo: no git commit recorded (not the repository root)');
        return null;
    }
    return maybeCommit ?? null;
}

const info = {
    timestamp: new Date().toISOString(),
    maybeCommit: process.env.GITHUB_SHA || maybeSourceCommit(),
    maybeRunUrl: maybeCiRunUrl(process.env),
};
writeFileSync(new URL('../src/js/buildInfo.ts', import.meta.url), buildInfoModule(info));

// The source archive sent to Firefox Add-ons reviewers leaves out the Safari app.
const safariDir = new URL('../safari/', import.meta.url);
if (existsSync(safariDir)) {
    const manifest = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8')) as { version: string };
    writeFileSync(new URL('Version.xcconfig', safariDir), safariVersionXcconfig(manifest.version));
}
