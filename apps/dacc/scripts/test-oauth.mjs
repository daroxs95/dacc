// Real workerd + isolated local D1/KV. Never reads or writes production data.
import assert from 'node:assert/strict';
import {createHash, randomBytes} from 'node:crypto';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync, spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const wrangler = fileURLToPath(new URL('../../../tools/cloudflare/node_modules/wrangler/bin/wrangler.js', import.meta.url));
const storage = await mkdtemp(join(tmpdir(), 'dacc-oauth-'));
const origin = 'https://dacc.darodev.site';
const resource = origin + '/mcp';
const redirect = 'https://client.example/callback';
const hash = text => createHash('sha256').update(text).digest('hex');
const session = 'local-only-oauth-test-session';
const sessionB = 'local-only-other-account-session';
const localToken = 'local-only-personal-token';
const run = args => execFileSync(process.execPath, [wrangler, ...args], {cwd, stdio: 'pipe'});
const socket = createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const base = `http://127.0.0.1:${port}`;
let server;
let serverOutput = '';
const request = (path, init = {}) => fetch(base + path, {...init, redirect: 'manual'});
const form = (path, values, cookie, requestOrigin) => request(path, {method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded', ...(cookie ? {Cookie: cookie} : {}), ...(requestOrigin ? {Origin: requestOrigin} : {})},
    body: new URLSearchParams(values)});
let client;
let metadata;

async function consent(overrides = {}, cookie = `dacc_session=${session}`) {
    const verifier = randomBytes(32).toString('base64url');
    const params = new URLSearchParams({client_id: client.client_id, redirect_uri: redirect, response_type: 'code',
        state: 'test-state', resource, scope: 'dacc:account offline_access',
        code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', ...overrides});
    const response = await request('/oauth/authorize?' + params, {headers: {Cookie: cookie}});
    const page = await response.text();
    const handle = page.match(/name="handle" value="([^"]+)"/)?.[1];
    const cookies = [cookie, ...response.headers.getSetCookie().map(value => value.split(';')[0])].join('; ');
    return {response, page, handle, cookie: cookies, verifier};
}
async function approve(pending, decision = 'approve', overrides = {}) {
    return form('/oauth/authorize', {handle: pending.handle, account: 'oauth-test-a', decision, ...overrides}, pending.cookie, origin);
}
async function grant() {
    const pending = await consent();
    assert.equal(pending.response.status, 200, pending.page);
    const response = await approve(pending);
    assert.equal(response.status, 302, await response.text());
    const location = new URL(response.headers.get('Location'));
    assert.equal(location.origin + location.pathname, redirect);
    assert.equal(location.searchParams.get('state'), 'test-state');
    assert.equal(location.searchParams.get('iss'), origin);
    return {pending, code: location.searchParams.get('code')};
}
async function exchange(grant, overrides = {}) {
    return form('/oauth/token', {grant_type: 'authorization_code', client_id: client.client_id,
        redirect_uri: redirect, code: grant.code, code_verifier: grant.pending.verifier, resource, ...overrides});
}
async function mcp(token, method = 'tools/list', params = {}) {
    return request('/mcp', {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
        ...(token ? {Authorization: `Bearer ${token}`} : {})}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params})});
}

try {
    run(['d1', 'migrations', 'apply', 'dacc', '--local', '--persist-to', storage]);
    const seed = join(storage, 'seed.sql');
    await writeFile(seed, `INSERT INTO users VALUES ('oauth-test-a','test-a','a@example.com','A'), ('oauth-test-b','test-b','b@example.com','B');
        INSERT INTO sessions VALUES ('${hash(session)}','oauth-test-a',${Date.now() + 3600000}), ('${hash(sessionB)}','oauth-test-b',${Date.now() + 3600000});
        INSERT INTO credentials VALUES ('test-token','${hash(localToken)}','oauth-test-a','local test',${Date.now()},${Date.now() + 3600000});`);
    run(['d1', 'execute', 'dacc', '--local', '--persist-to', storage, '--file', seed]);
    server = spawn(process.execPath, [wrangler, 'dev', '--local', '--port', String(port), '--inspector-port', '0',
        '--local-upstream', new URL(origin).host, '--upstream-protocol', 'https', '--persist-to', storage,
        '--var', 'GOOGLE_CLIENT_SECRET:local-test-placeholder'], {cwd, stdio: ['ignore', 'pipe', 'pipe']});
    for (const stream of [server.stdout, server.stderr]) stream.on('data', data => { serverOutput = (serverOutput + data).slice(-16000); });
    for (let attempt = 0; attempt < 100; attempt++) {
        try {
            const response = await request('/.well-known/oauth-authorization-server');
            if (response.ok) { metadata = await response.json(); break; }
        } catch { /* workerd is starting */ }
        await delay(200);
    }
    assert.ok(metadata, 'Worker did not start: ' + serverOutput);
    assert.equal(metadata.issuer, origin);
    assert.ok(metadata.code_challenge_methods_supported.includes('S256'));
    assert.ok(metadata.client_id_metadata_document_supported);
    const unauthenticated = await mcp();
    assert.equal(unauthenticated.status, 401);
    assert.match(unauthenticated.headers.get('WWW-Authenticate'), /oauth-protected-resource/);
    const protectedMetadata = await (await request('/.well-known/oauth-protected-resource/mcp')).json();
    assert.equal(protectedMetadata.resource, resource);
    assert.deepEqual(protectedMetadata.authorization_servers, [origin]);
    const registered = await request('/oauth/register', {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({client_name: 'DACC test', redirect_uris: [redirect], token_endpoint_auth_method: 'none',
            grant_types: ['authorization_code', 'refresh_token'], response_types: ['code']})});
    assert.equal(registered.status, 201, await registered.clone().text());
    client = await registered.json();
    console.log('PASS discovery, unauthenticated challenge, and public client registration');

    const anonymous = await consent({}, '');
    assert.equal(anonymous.response.status, 200);
    assert.ok(anonymous.page.includes('Continue with Google'));
    assert.equal(anonymous.handle, undefined);
    const invalidRedirect = await consent({redirect_uri: 'https://evil.example/callback'});
    assert.equal(invalidRedirect.response.status, 400);
    assert.equal(invalidRedirect.response.headers.get('Location'), null);
    const wrongResource = await consent({resource: 'https://evil.example/mcp'});
    assert.notEqual(wrongResource.response.status, 200);
    const noPkce = await consent({code_challenge: '', code_challenge_method: ''});
    assert.notEqual(noPkce.response.status, 200);
    const unknownScope = await consent({scope: 'admin'});
    assert.notEqual(unknownScope.response.status, 200);
    const pending = await consent();
    assert.match(pending.response.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
    assert.equal(pending.response.headers.get('Referrer-Policy'), 'strict-origin');
    assert.ok(pending.response.headers.get('Content-Security-Policy').includes("form-action 'self' https://client.example;"));
    assert.ok(pending.page.includes('/assets/root-'));
    assert.equal((await form('/oauth/authorize', {handle: pending.handle, account: 'oauth-test-a', decision: 'approve'}, `dacc_session=${session}`, origin)).status, 400);
    assert.equal((await form('/oauth/authorize', {handle: pending.handle, account: 'oauth-test-a', decision: 'approve'}, pending.cookie, 'https://evil.example')).status, 403);
    assert.equal((await approve(pending, 'approve', {account: 'oauth-test-b'})).status, 400);
    const denied = await approve(pending, 'deny');
    assert.equal(denied.status, 302);
    assert.equal(new URL(denied.headers.get('Location')).searchParams.get('error'), 'access_denied');
    assert.equal((await approve(pending)).status, 400);
    console.log('PASS explicit consent, cookie/CSRF/account binding, redirect/resource/scope/PKCE validation, denial and replay');

    const badProof = await grant();
    assert.equal((await exchange(badProof, {code_verifier: 'wrong-proof'.repeat(5)})).status, 400);
    const badAudience = await grant();
    assert.equal((await exchange(badAudience, {resource: 'https://evil.example/mcp'})).status, 400);
    const authorized = await grant();
    const tokenResponse = await exchange(authorized);
    assert.equal(tokenResponse.status, 200, await tokenResponse.clone().text());
    const tokens = await tokenResponse.json();
    assert.ok(tokens.access_token && tokens.refresh_token);
    assert.equal(tokens.expires_in, 3600);
    const initialized = await mcp(tokens.access_token, 'initialize', {protocolVersion: '2025-03-26', capabilities: {}, clientInfo: {name: 'test', version: '1'}});
    assert.equal(initialized.status, 200);
    const listed = await (await mcp(tokens.access_token)).json();
    assert.ok(listed.result.tools.length > 0);
    const profilesResponse = await (await mcp(tokens.access_token, 'tools/call', {name: 'dacc_list_profiles', arguments: {}})).json();
    const connectedProfiles = JSON.parse(profilesResponse.result.content[0].text).data.profiles.map(item => item.profile.id);
    const own = await (await request('/api/database', {headers: {Cookie: `dacc_session=${session}`}})).json();
    const other = await (await request('/api/database', {headers: {Cookie: `dacc_session=${sessionB}`}})).json();
    assert.deepEqual(connectedProfiles, own.profiles.map(item => item.id));
    assert.ok(!connectedProfiles.includes(other.profiles[0].id));
    assert.equal((await mcp(localToken)).status, 200);
    assert.equal((await mcp('invalid-token')).status, 401);
    // OAuth tokens cannot be used as browser session credentials.
    assert.equal((await request('/api/me', {headers: {Authorization: `Bearer ${tokens.access_token}`}})).status, 401);
    console.log('PASS PKCE token exchange, resource/account isolation, MCP initialization/tools, and personal-token compatibility');

    const refreshed = await form('/oauth/token', {grant_type: 'refresh_token', client_id: client.client_id, refresh_token: tokens.refresh_token, resource});
    assert.equal(refreshed.status, 200, await refreshed.clone().text());
    const renewed = await refreshed.json();
    assert.ok(renewed.refresh_token !== tokens.refresh_token);
    assert.equal((await mcp(renewed.access_token)).status, 200);
    const revoked = await form(new URL(metadata.revocation_endpoint).pathname,
        {client_id: client.client_id, token: renewed.refresh_token, token_type_hint: 'refresh_token'});
    assert.equal(revoked.status, 200, await revoked.text());
    assert.equal((await mcp(renewed.access_token)).status, 401);
    assert.equal((await form('/oauth/token', {grant_type: 'refresh_token', client_id: client.client_id, refresh_token: renewed.refresh_token, resource})).status, 400);
    assert.equal((await exchange(authorized)).status, 400);
    console.log('PASS refresh rotation, revocation, and code replay rejection');

    const onlineOnly = await consent({scope: 'dacc:account'});
    const onlineRedirect = await approve(onlineOnly);
    const onlineCode = new URL(onlineRedirect.headers.get('Location')).searchParams.get('code');
    const onlineTokens = await (await exchange({pending: onlineOnly, code: onlineCode})).json();
    assert.ok(onlineTokens.access_token);
    assert.equal(onlineTokens.refresh_token, undefined);
    console.log('PASS refresh tokens require explicit offline access consent');
} finally {
    if (server) {
        server.kill('SIGTERM');
        await new Promise(resolve => server.once('exit', resolve));
    }
    await rm(storage, {recursive: true, force: true});
}
