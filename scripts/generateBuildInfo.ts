import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { safariVersionXcconfig } from './safariVersion.ts';

const buildInfo = `export const BUILD_TIMESTAMP = ${JSON.stringify(new Date().toISOString())};
`;

writeFileSync(new URL('../src/js/buildInfo.ts', import.meta.url), buildInfo);

// The source archive sent to Firefox Add-ons reviewers leaves out the Safari app.
const safariDir = new URL('../safari/', import.meta.url);
if (existsSync(safariDir)) {
    const manifest = JSON.parse(readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8')) as { version: string };
    writeFileSync(new URL('Version.xcconfig', safariDir), safariVersionXcconfig(manifest.version));
}
