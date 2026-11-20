import {test} from 'node:test';
import assert from 'node:assert/strict';
import {consentPage, appStylesheets, consentSecurityHeaders} from './oauth-consent';
import {loginReturnPath} from './auth';

test('Google login resumes only the same-origin OAuth consent route', () => {
    const origin = 'https://dacc.example';
    assert.equal(loginReturnPath('/oauth/authorize?client_id=test&state=abc', origin), '/oauth/authorize?client_id=test&state=abc');
    for (const value of [undefined, '//evil.example/oauth/authorize', '/\\evil.example/oauth/authorize', 'https://evil.example', '/auth/logout', '/oauth/authorize/../token']) {
        assert.equal(loginReturnPath(value, origin), '/');
    }
});

test('consent renders permissions and destination but escapes all untrusted client metadata', async () => {
    const page = await consentPage({clientId: 'test', clientName: '<script>alert(1)</script>', clientDomain: 'trusted.example',
        redirectUri: 'https://callback.example/return', redirectHost: 'callback.example', redirectIsLoopback: false, scope: ['dacc:account', 'offline_access']},
        ['/assets/root-test.css'], {loginUrl: '/auth/google?return_to=%2Foauth%2Fauthorize', user: {id: 'test', name: 'Tester', email: 'a@example.com'}, handle: 'handle'});
    assert.ok(!page.includes('<script>'));
    assert.ok(page.includes('&lt;script&gt;'));
    assert.ok(page.includes('callback.example'));
    assert.ok(page.includes('Read your invoices'));
    assert.ok(page.includes('Create and update invoices'));
    assert.ok(page.includes('renewable tokens'));
    assert.ok(page.includes('name="handle" value="handle"'));
    assert.ok(page.includes('name="account" value="test"'));
    assert.ok(page.includes('form method="post"'));
});

test('consent reuses only bundled app stylesheets', () => {
    assert.deepEqual(appStylesheets('<link rel="stylesheet" href="/assets/root-abc.css"/><link rel="stylesheet" href="https://external.example/style.css"/>'), ['/assets/root-abc.css']);
});

test('native consent form preserves Origin and permits only the validated callback origin', () => {
    const headers = consentSecurityHeaders('https://chatgpt.com/connector_platform_oauth_redirect?state=private');
    assert.equal(headers['Referrer-Policy'], 'strict-origin');
    assert.match(headers['Content-Security-Policy'], /form-action 'self' https:\/\/chatgpt.com;/);
    assert.ok(!headers['Content-Security-Policy'].includes('private'));
    assert.equal(headers['X-Frame-Options'], 'DENY');
    assert.throws(() => consentSecurityHeaders('https://example.com;/callback'));
    assert.throws(() => consentSecurityHeaders('javascript:alert(1)'));
});
