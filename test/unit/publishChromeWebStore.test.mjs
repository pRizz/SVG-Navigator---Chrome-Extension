import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { getAccessToken, publishToChromeWebStore } from '../../scripts/publishChromeWebStore.mjs';

/**
 * A fetch stand-in that answers by the request URL's trailing `:method`
 * (`:upload`, `:fetchStatus`, `:publish`) or full URL, consuming queued responses
 * in order and recording every call.
 */
function fakeFetch(routes) {
    const calls = [];
    const fetchFn = async (url, init = {}) => {
        const key = Object.keys(routes).find((route) => String(url).endsWith(route));
        assert.ok(key, `unexpected request to ${url}`);
        calls.push({ route: key, url: String(url), init });
        const [status, body] = routes[key].shift();
        return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
    };
    return { fetchFn, calls };
}

const ITEM = { publisherId: 'pub-1', extensionId: 'ext-1', accessToken: 'token-1' };
const silent = { wait: async () => {}, log: () => {} };

describe('getAccessToken', () => {
    test('exchanges a JWT signed with the service account key for an access token', async () => {
        // Arrange
        const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        const serviceAccountKey = {
            client_email: 'publisher@example.iam.gserviceaccount.com',
            private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
        };
        const { fetchFn, calls } = fakeFetch({ 'oauth2.googleapis.com/token': [[200, { access_token: 'ya29.token' }]] });

        // Act
        const token = await getAccessToken(serviceAccountKey, { fetchFn, nowMs: 1_000_000 });

        // Assert
        assert.equal(token, 'ya29.token');
        const params = new URLSearchParams(calls[0].init.body);
        assert.equal(params.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
        const [header, claims, signature] = params.get('assertion').split('.');
        const verifier = createVerify('RSA-SHA256').update(`${header}.${claims}`);
        assert.ok(verifier.verify(publicKey, signature, 'base64url'), 'JWT signature should verify');
        assert.deepEqual(JSON.parse(Buffer.from(claims, 'base64url').toString()), {
            iss: serviceAccountKey.client_email,
            scope: 'https://www.googleapis.com/auth/chromewebstore',
            aud: 'https://oauth2.googleapis.com/token',
            iat: 1000,
            exp: 4600,
        });
    });
});

describe('publishToChromeWebStore', () => {
    test('uploads the package and then submits it for review', async () => {
        // Arrange
        const packageBytes = Buffer.from('zip-bytes');
        const { fetchFn, calls } = fakeFetch({
            ':upload': [[200, { uploadState: 'SUCCEEDED', crxVersion: '2.11' }]],
            ':publish': [[200, { state: 'PENDING_REVIEW' }]],
        });

        // Act
        const state = await publishToChromeWebStore({ ...ITEM, packageBytes, fetchFn, ...silent });

        // Assert
        assert.equal(state, 'PENDING_REVIEW');
        assert.deepEqual(calls.map((call) => call.route), [':upload', ':publish']);
        assert.equal(calls[0].url, 'https://chromewebstore.googleapis.com/upload/v2/publishers/pub-1/items/ext-1:upload');
        assert.equal(calls[0].init.body, packageBytes);
        assert.equal(calls[0].init.headers.authorization, 'Bearer token-1');
        assert.deepEqual(JSON.parse(calls[1].init.body), { publishType: 'DEFAULT_PUBLISH' });
    });

    test('polls the status while the upload is still processing', async () => {
        // Arrange
        const { fetchFn, calls } = fakeFetch({
            ':upload': [[200, { uploadState: 'IN_PROGRESS' }]],
            ':fetchStatus': [[200, { lastAsyncUploadState: 'IN_PROGRESS' }], [200, { lastAsyncUploadState: 'SUCCEEDED' }]],
            ':publish': [[200, { state: 'PENDING_REVIEW' }]],
        });

        // Act
        await publishToChromeWebStore({ ...ITEM, packageBytes: Buffer.alloc(0), fetchFn, ...silent });

        // Assert
        assert.deepEqual(calls.map((call) => call.route), [':upload', ':fetchStatus', ':fetchStatus', ':publish']);
    });

    test('does not publish when the upload fails', async () => {
        // Arrange
        const { fetchFn, calls } = fakeFetch({ ':upload': [[200, { uploadState: 'FAILED' }]] });

        // Act
        const publishing = publishToChromeWebStore({ ...ITEM, packageBytes: Buffer.alloc(0), fetchFn, ...silent });

        // Assert
        await assert.rejects(publishing, /Upload did not succeed \(state: FAILED\)/);
        assert.deepEqual(calls.map((call) => call.route), [':upload']);
    });

    test('fails when the store does not accept the submission', async () => {
        // Arrange
        const { fetchFn } = fakeFetch({
            ':upload': [[200, { uploadState: 'SUCCEEDED' }]],
            ':publish': [[200, { state: 'REJECTED' }]],
        });

        // Act
        const publishing = publishToChromeWebStore({ ...ITEM, packageBytes: Buffer.alloc(0), fetchFn, ...silent });

        // Assert
        await assert.rejects(publishing, /Publish was not accepted \(state: REJECTED\)/);
    });

    test('reports the HTTP status and body of a failed request', async () => {
        // Arrange
        const { fetchFn } = fakeFetch({ ':upload': [[400, 'Version must be greater than published']] });

        // Act
        const publishing = publishToChromeWebStore({ ...ITEM, packageBytes: Buffer.alloc(0), fetchFn, ...silent });

        // Assert
        await assert.rejects(publishing, /Upload failed: HTTP 400 Version must be greater than published/);
    });
});
