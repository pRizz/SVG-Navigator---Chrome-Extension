/**
 * Uploads a packaged extension to the Chrome Web Store and submits it for review,
 * using the Chrome Web Store API v2 authenticated as a Google service account.
 *
 * Usage: node scripts/publishChromeWebStore.mjs <package.zip>
 *        node scripts/publishChromeWebStore.mjs --check   (read-only credentials check)
 *
 * Environment:
 *   CWS_SERVICE_ACCOUNT_KEY  the service account's JSON key (file contents, not a path)
 *   CWS_PUBLISHER_ID         Developer Dashboard > Publisher > Settings
 *   CWS_EXTENSION_ID         the store item ID
 *
 * API reference: https://developer.chrome.com/docs/webstore/using-api
 */

import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const API_ROOT = 'https://chromewebstore.googleapis.com';
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const UPLOAD_POLL_INTERVAL_MS = 5_000;
const UPLOAD_MAX_POLLS = 60;
// Publish states that mean the store accepted the submission.
const ACCEPTED_PUBLISH_STATES = new Set(['PENDING_REVIEW', 'STAGED', 'PUBLISHED', 'PUBLISHED_TO_TESTERS']);

/**
 * Exchanges a self-signed JWT for an OAuth access token, as documented for service
 * accounts: https://developers.google.com/identity/protocols/oauth2/service-account#httprest
 * @param {{ client_email: string, private_key: string, token_uri?: string }} serviceAccountKey
 * @returns {Promise<string>} access token
 */
export async function getAccessToken(serviceAccountKey, { fetchFn = fetch, nowMs = Date.now() } = {}) {
    const tokenUri = serviceAccountKey.token_uri ?? DEFAULT_TOKEN_URI;
    const issuedAt = Math.floor(nowMs / 1000);
    const unsignedJwt = [
        { alg: 'RS256', typ: 'JWT' },
        { iss: serviceAccountKey.client_email, scope: SCOPE, aud: tokenUri, iat: issuedAt, exp: issuedAt + 3600 },
    ].map((part) => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.');
    const signature = createSign('RSA-SHA256').update(unsignedJwt).sign(serviceAccountKey.private_key, 'base64url');

    const response = await fetchFn(tokenUri, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: `${unsignedJwt}.${signature}`,
        }),
    });
    const { access_token: accessToken } = await parseJsonResponse(response, 'Token exchange');
    return accessToken;
}

/**
 * Uploads `packageBytes` as the item's new draft, waits for processing, then submits
 * it for review. Throws unless the store accepts the submission.
 * @returns {Promise<string>} the item's publish state, e.g. PENDING_REVIEW
 */
export async function publishToChromeWebStore({
    packageBytes,
    publisherId,
    extensionId,
    accessToken,
    fetchFn = fetch,
    wait = sleep,
    log = console.log,
}) {
    const itemPath = `publishers/${publisherId}/items/${extensionId}`;
    const authorization = `Bearer ${accessToken}`;

    const upload = await parseJsonResponse(await fetchFn(`${API_ROOT}/upload/v2/${itemPath}:upload`, {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/zip' },
        body: packageBytes,
    }), 'Upload');
    log(`Uploaded package (state: ${upload.uploadState}, version: ${upload.crxVersion ?? 'unknown'})`);

    let uploadState = upload.uploadState;
    for (let poll = 0; uploadState === 'IN_PROGRESS'; poll++) {
        if (poll >= UPLOAD_MAX_POLLS) {
            throw new Error(`Upload still processing after ${UPLOAD_MAX_POLLS} status checks`);
        }
        await wait(UPLOAD_POLL_INTERVAL_MS);
        const status = await parseJsonResponse(
            await fetchFn(`${API_ROOT}/v2/${itemPath}:fetchStatus`, { headers: { authorization } }),
            'Status check',
        );
        uploadState = status.lastAsyncUploadState;
        log(`Upload state: ${uploadState}`);
    }
    if (uploadState !== 'SUCCEEDED') {
        throw new Error(`Upload did not succeed (state: ${uploadState})`);
    }

    const published = await parseJsonResponse(await fetchFn(`${API_ROOT}/v2/${itemPath}:publish`, {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH' }),
    }), 'Publish');
    if (!ACCEPTED_PUBLISH_STATES.has(published.state)) {
        throw new Error(`Publish was not accepted (state: ${published.state})`);
    }
    log(`Submitted for publishing (state: ${published.state})`);
    return published.state;
}

/**
 * Read-only: fetches the item's published and pending revision status. Succeeds only
 * when the credentials, publisher ID and extension ID are all valid.
 */
export async function fetchItemStatus({ publisherId, extensionId, accessToken, fetchFn = fetch }) {
    const response = await fetchFn(`${API_ROOT}/v2/publishers/${publisherId}/items/${extensionId}:fetchStatus`, {
        headers: { authorization: `Bearer ${accessToken}` },
    });
    return parseJsonResponse(response, 'Status check');
}

function describeRevision(revision) {
    if (!revision) { return 'none'; }
    const versions = (revision.distributionChannels ?? []).map((channel) => channel.crxVersion).join(', ');
    return `${revision.state}${versions ? ` (version ${versions})` : ''}`;
}

async function parseJsonResponse(response, step) {
    if (!response.ok) {
        throw new Error(`${step} failed: HTTP ${response.status} ${await response.text()}`);
    }
    return response.json();
}

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable ${name}`);
    }
    return value;
}

async function main() {
    const [packagePathOrFlag] = process.argv.slice(2);
    if (!packagePathOrFlag) {
        throw new Error('Usage: node scripts/publishChromeWebStore.mjs <package.zip> | --check');
    }
    const serviceAccountKey = JSON.parse(requireEnv('CWS_SERVICE_ACCOUNT_KEY'));
    const item = {
        publisherId: requireEnv('CWS_PUBLISHER_ID'),
        extensionId: requireEnv('CWS_EXTENSION_ID'),
        accessToken: await getAccessToken(serviceAccountKey),
    };
    if (packagePathOrFlag === '--check') {
        const status = await fetchItemStatus(item);
        console.log(`Credentials OK for ${serviceAccountKey.client_email}`);
        console.log(`Published: ${describeRevision(status.publishedItemRevisionStatus)}`);
        console.log(`Submitted: ${describeRevision(status.submittedItemRevisionStatus)}`);
        return;
    }
    await publishToChromeWebStore({ ...item, packageBytes: await readFile(packagePathOrFlag) });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
}
