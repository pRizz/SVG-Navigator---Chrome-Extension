import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const buildInfo = `export const BUILD_TIMESTAMP = ${JSON.stringify(new Date().toISOString())};
`;

const buildInfoPath = join(__dirname, '../src/js/buildInfo.js');
writeFileSync(buildInfoPath, buildInfo); 