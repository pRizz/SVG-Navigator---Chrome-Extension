/**
 * `bun run start:firefox`: runs `web-ext run` (Firefox with the dev build loaded) on
 * Node.js. Under Bun, web-ext's first connection to Firefox's debugger port, which is
 * refused until Firefox finishes starting, escapes web-ext's retry loop and aborts the
 * run; under Node it retries and connects.
 *
 * bunfig.toml's `run.bun` puts a `node` shim for Bun first on PATH, so this looks past
 * it for a real Node.js. Extra arguments are passed through to `web-ext run`.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webExtBin = fileURLToPath(new URL('../node_modules/web-ext/bin/web-ext.js', import.meta.url));

/** True for a `node` that is really Node.js, not Bun answering to that name. */
function isRealNode(binary: string): boolean {
    const result = spawnSync(binary, ['-p', 'process.versions.bun ?? "node"'], { encoding: 'utf8' });
    return result.status === 0 && result.stdout.trim() === 'node';
}

function findRealNode(): string {
    const candidates = (process.env.PATH ?? '')
        .split(path.delimiter)
        .map((dir) => path.join(dir, 'node'))
        .filter((binary) => existsSync(binary));
    const maybeNode = candidates.find(isRealNode);
    if (maybeNode === undefined) {
        throw new Error('start:firefox needs Node.js on PATH: web-ext cannot connect to Firefox when run on Bun');
    }
    return maybeNode;
}

const result = spawnSync(findRealNode(), [webExtBin, 'run', ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) {
    throw result.error;
}
process.exit(result.status ?? 1);
