import {OAuthProvider, insufficientScope, type OAuthHelpers, type OAuthResourceContext} from '@cloudflare/workers-oauth-provider';
import {createApp} from './app';
import {authenticate, type User} from './auth';
import type {Sql} from './sql';
import {registerOAuth} from './oauth';
import {appStylesheets, MCP_SCOPE, MCP_SCOPES} from './oauth-consent';

type Bindings = Env & {GOOGLE_CLIENT_SECRET: string; OAUTH_PROVIDER: OAuthHelpers};
type OAuthIdentity = {userId: string; legacy?: boolean};

function database(env: Pick<Bindings, 'DB'>): Sql {
    return {
        first: <T>(query: string, params: unknown[] = []) => env.DB.prepare(query).bind(...params).first<T>(),
        all: async <T>(query: string, params: unknown[] = []) => (await env.DB.prepare(query).bind(...params).all<T>()).results,
        run: async (query, params = []) => (await env.DB.prepare(query).bind(...params).run()).meta.changes,
    };
}

export default {
    async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
        const origin = new URL(env.APP_URL).origin;
        if (new URL(request.url).host !== new URL(origin).host) return new Response('Unexpected host.', {status: 403});
        const provider = new OAuthProvider<Bindings>({
            apiRoute: '/mcp',
            authorizeEndpoint: `${origin}/oauth/authorize`,
            tokenEndpoint: `${origin}/oauth/token`,
            clientRegistrationEndpoint: `${origin}/oauth/register`,
            clientRegistrationTTL: undefined,
            clientIdMetadataDocumentEnabled: true,
            scopesSupported: MCP_SCOPES,
            requiredScopes: [MCP_SCOPE],
            accessTokenTTL: 3600,
            refreshTokenTTL: 30 * 86400,
            tokenExchangeCallback: async ({grantType, scope}) => {
                if (grantType === 'authorization_code' && !scope.includes('offline_access')) return {refreshTokenTTL: 0};
            },
            resourceMetadata: {resource: `${origin}/mcp`, authorization_servers: [origin], resource_name: 'DACC'},
            // Retain DACC's existing, locally issued personal tokens for other MCP clients.
            resolveExternalToken: async ({token, env}) => {
                const user = await authenticate(database(env), token, 'credentials');
                return user ? {props: {userId: user.id, legacy: true}, audience: `${origin}/mcp`} : null;
            },
            apiHandler: {async fetch(request, env, context) {
                const auth = context as OAuthResourceContext<OAuthIdentity>;
                if (!auth.props.legacy && !auth.auth.scope.includes(MCP_SCOPE)) return insufficientScope(auth.auth, [MCP_SCOPE]);
                const sql = database(env);
                const user = await sql.first<User>('SELECT id, email, name FROM users WHERE id = ?', [auth.props.userId]);
                if (!user) return new Response('Account unavailable.', {status: 401});
                return createApp(sql, env, user).fetch(request);
            }},
            defaultHandler: {async fetch(request, env) {
                const app = createApp(database(env), env);
                registerOAuth(app, env.OAUTH_PROVIDER, env, async () => {
                    const index = await env.ASSETS.fetch(new Request(`${origin}/index.html`));
                    return appStylesheets(await index.text());
                });
                app.get('*', c => env.ASSETS.fetch(c.req.raw));
                return app.fetch(request);
            }},
            onError({code, internal}) {
                // Do not log codes, tokens, client secrets, or OAuth query strings.
                console.warn('DACC OAuth error', {code, category: internal.category, reason: internal.reason});
            },
        });
        return provider.fetch(request, env, ctx);
    },
} satisfies ExportedHandler<Bindings>;
