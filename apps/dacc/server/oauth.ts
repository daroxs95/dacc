import {AuthorizationError, CimdFetchError, type OAuthHelpers} from '@cloudflare/workers-oauth-provider';
import type {Hono} from 'hono';
import {getCookie} from 'hono/cookie';
import {authenticate, type Environment, type Settings} from './auth';
import {consentPage, consentSecurityHeaders, MCP_SCOPE, MCP_SCOPES} from './oauth-consent';

export function registerOAuth(app: Hono<Environment>, oauth: OAuthHelpers, settings: Settings, stylesheets: () => Promise<string[]>) {
    app.all('/oauth/authorize', async c => {
        c.header('Cache-Control', 'no-store');
        c.header('Referrer-Policy', 'strict-origin');
        try {
            const session = getCookie(c, 'dacc_session');
            const user = session ? await authenticate(c.get('sql'), session, 'sessions') : null;
            if (c.req.method === 'GET') {
                const request = await oauth.parseAuthRequest(c.req.raw);
                if (!request.codeChallenge || request.codeChallengeMethod !== 'S256') return c.text('S256 PKCE is required.', 400);
                if (request.scope.some(scope => !MCP_SCOPES.includes(scope))) return c.text('Unsupported permission requested.', 400);
                if (!request.scope.includes(MCP_SCOPE)) request.scope.push(MCP_SCOPE);
                const details = await oauth.describeConsent(request);
                const consent = user ? await oauth.beginConsent(request) : null;
                const headers = consent?.headers ?? new Headers();
                headers.set('Content-Type', 'text/html; charset=utf-8');
                headers.set('Cache-Control', 'no-store');
                for (const [name, value] of Object.entries(consentSecurityHeaders(details.redirectUri))) headers.set(name, value);
                const returnTo = '/oauth/authorize' + new URL(c.req.url).search;
                return new Response(await consentPage(details, await stylesheets(), {
                    user: user ?? undefined, handle: consent?.handle,
                    loginUrl: '/auth/google?return_to=' + encodeURIComponent(returnTo),
                }), {headers});
            }
            if (c.req.method !== 'POST') return c.text('Method not allowed.', 405);
            if (!user) return c.text('Your session expired. Start the connection again.', 401);
            const form = await c.req.formData();
            if (form.get('account') !== user.id) return c.text('Your account changed. Start the connection again.', 400);
            const handle = String(form.get('handle') ?? '');
            if (form.get('decision') === 'deny') {
                const denied = await oauth.denyConsent(c.req.raw, handle);
                return new Response(null, {status: 302, headers: denied.headers});
            }
            if (form.get('decision') !== 'approve') return c.text('Choose whether to allow access.', 400);
            const approved = await oauth.approveConsent(c.req.raw, handle);
            const client = await oauth.describeConsent(approved.request);
            const {redirectTo} = await oauth.completeAuthorization({
                request: approved.request, userId: user.id,
                scope: approved.request.scope, metadata: {name: client.clientName}, props: {userId: user.id},
            });
            approved.headers.set('Location', redirectTo);
            return new Response(null, {status: 302, headers: approved.headers});
        } catch (error) {
            if (error instanceof AuthorizationError) {
                if (error.redirectTo) return c.redirect(error.redirectTo);
                return c.text(error.description, 400);
            }
            if (error instanceof CimdFetchError) return c.text('The requesting app could not be verified. Please try connecting again.', 400);
            throw error;
        }
    });
}
