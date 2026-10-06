import { writeFileSync } from 'node:fs';

const buildInfo = `export const BUILD_TIMESTAMP = ${JSON.stringify(new Date().toISOString())};
`;

writeFileSync(new URL('../src/js/buildInfo.ts', import.meta.url), buildInfo);
