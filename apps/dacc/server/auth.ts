import {Google, generateCodeVerifier, generateState} from 'arctic';
import {getCookie, setCookie, deleteCookie} from 'hono/cookie';
import type {Hono} from 'hono';
import type {Sql} from './sql';

export type Settings = {APP_URL: string; GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string};
export type User = {id: string; email: string; name: string};
export type Environment = {Variables: {user: User; sql: Sql}};
export async function hash(value: string) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}
export function secret() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join('');
}

export function registerAuth(app: Hono<Environment>, settings: Settings) {
    const cookieOptions = {httpOnly: true, secure: new URL(settings.APP_URL).protocol === 'https:', sameSite: 'Lax' as const, path: '/'};
    const google = () => new Google(settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET, `${settings.APP_URL}/auth/google/callback`);
    app.get('/auth/google', async c => {
        if (!settings.GOOGLE_CLIENT_ID || !settings.GOOGLE_CLIENT_SECRET) return c.text('Google login has not been configured.', 503);
        const state = generateState();
        const verifier = generateCodeVerifier();
        const sql = c.get('sql');
        await sql.run('DELETE FROM oauth_states WHERE expires_at < ?', [Date.now()]);
        await sql.run('INSERT INTO oauth_states(hash, verifier, expires_at) VALUES (?, ?, ?)', [await hash(state), verifier, Date.now() + 600000]);
        setCookie(c, 'dacc_oauth', state, {...cookieOptions, maxAge: 600});
        return c.redirect(google().createAuthorizationURL(state, verifier, ['openid', 'email', 'profile']).toString());
    });
    app.get('/auth/google/callback', async c => {
        const state = c.req.query('state');
        const code = c.req.query('code');
        const cookie = getCookie(c, 'dacc_oauth');
        deleteCookie(c, 'dacc_oauth', cookieOptions);
        if (!state || !code || state !== cookie) return c.text('Login expired. Start again.', 400);
        const sql = c.get('sql');
        const attempt = await sql.first<{verifier: string}>('DELETE FROM oauth_states WHERE hash = ? AND expires_at > ? RETURNING verifier', [await hash(state), Date.now()]);
        if (!attempt) return c.text('Login expired. Start again.', 400);
        try {
            const tokens = await google().validateAuthorizationCode(code, attempt.verifier);
            const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {headers: {Authorization: `Bearer ${tokens.accessToken()}`}});
            if (!response.ok) throw new Error('Google user information unavailable');
            const info = await response.json() as {sub?: string; email?: string; name?: string; email_verified?: boolean};
            if (!info.sub || !info.email || !info.email_verified) return c.text('A verified Google email is required.', 403);
            await sql.run('INSERT INTO users(id, google_id, email, name) VALUES (?, ?, ?, ?) ON CONFLICT(google_id) DO UPDATE SET email = excluded.email, name = excluded.name',
                [crypto.randomUUID(), info.sub, info.email, info.name ?? info.email]);
            const user = await sql.first<User>('SELECT id, email, name FROM users WHERE google_id = ?', [info.sub]);
            const token = secret();
            await sql.run('INSERT INTO sessions(hash, user_id, expires_at) VALUES (?, ?, ?)', [await hash(token), user!.id, Date.now() + 30 * 86400000]);
            setCookie(c, 'dacc_session', token, {...cookieOptions, maxAge: 30 * 86400});
            return c.redirect('/');
        } catch {
            return c.text('Google login failed. Please start again.', 400);
        }
    });
    app.post('/auth/logout', async c => {
        const token = getCookie(c, 'dacc_session');
        if (token) await c.get('sql').run('DELETE FROM sessions WHERE hash = ?', [await hash(token)]);
        deleteCookie(c, 'dacc_session', cookieOptions);
        return c.json({ok: true});
    });
}

export async function authenticate(sql: Sql, token: string, kind: 'sessions' | 'credentials') {
    return sql.first<User>(`SELECT users.id, users.email, users.name FROM ${kind} JOIN users ON users.id = ${kind}.user_id WHERE ${kind}.hash = ? AND ${kind}.expires_at > ?`, [await hash(token), Date.now()]);
}
