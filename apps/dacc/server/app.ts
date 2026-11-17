import {Hono, type MiddlewareHandler} from 'hono';
import {getCookie} from 'hono/cookie';
import {bodyLimit} from 'hono/body-limit';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {ListToolsRequestSchema, CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {authenticate, hash, registerAuth, secret, type Environment, type Settings} from './auth';
import type {Sql} from './sql';
import {AccountStore} from './store';
import {createSiteTools} from '../app/lib/site-tools';
import {parseBackup, validateInvoice, validateProfile} from '../app/lib/data-model';
import {checkVersion, OperationError} from '../app/lib/record-version';

export function createApp(sql: Sql, settings: Settings) {
    const app = new Hono<Environment>();
    const origin = new URL(settings.APP_URL).origin;
    app.use('*', async (c, next) => {
        c.set('sql', sql);
        if (new URL(c.req.url).host !== new URL(origin).host) return c.json({error: {message: 'Unexpected host.'}}, 403);
        const requestOrigin = c.req.header('Origin');
        if (requestOrigin && requestOrigin !== origin) return c.json({error: {message: 'Unexpected origin.'}}, 403);
        if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && c.req.path !== '/mcp' && requestOrigin !== origin) {
            return c.json({error: {message: 'Same-origin request required.'}}, 403);
        }
        await next();
        if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/auth/') || c.req.path === '/mcp') c.header('Cache-Control', 'no-store');
    });
    app.use('*', bodyLimit({maxSize: 11 * 1024 * 1024}));
    app.onError((error, c) => {
        if (error instanceof OperationError) return c.json({error: {code: error.code, message: error.message}}, 409);
        console.error('DACC request failed', error instanceof Error ? error.name : 'Unknown error');
        return c.json({error: {code: 'OPERATION_FAILED', message: 'The operation failed.'}}, 500);
    });
    registerAuth(app, settings);
    const requireUser: MiddlewareHandler<Environment> = async (c, next) => {
        const bearer = c.req.header('Authorization');
        const token = c.req.path === '/mcp' ? bearer?.match(/^Bearer (\S+)$/)?.[1] : getCookie(c, 'dacc_session');
        const user = token && await authenticate(sql, token, c.req.path === '/mcp' ? 'credentials' : 'sessions');
        if (!user) return c.json({error: {code: 'UNAUTHENTICATED', message: 'Sign in to DACC.'}}, 401);
        c.set('user', user);
        await next();
    };
    app.use('/api/*', requireUser);
    app.use('/mcp', requireUser);
    app.get('/api/me', c => c.json(c.get('user')));
    app.get('/api/database', async c => c.json(await (await new AccountStore(sql, c.get('user').id).open()).readDatabase()));

    app.post('/api/command/:name', async c => {
        const store = await new AccountStore(sql, c.get('user').id).open();
        const args = await c.req.json();
        const name = c.req.param('name');
        if (!args || typeof args !== 'object' || Array.isArray(args)) return c.json({error: {message: 'Invalid input.'}}, 400);
        if (['restoreProfile', 'importBrowser'].includes(name) && (typeof args.requestId !== 'string' || args.requestId.length > 200 || !args.requestId)) return c.json({error: {message: 'Request ID required.'}}, 400);
        try {
            const result = await store.changeRecords(data => {
                switch (name) {
                    case 'selectProfile': {
                        if (!data.profiles.some(item => item.id === args.id)) throw new Error('Invalid profile.');
                        data.activeProfileId = args.id;
                        break;
                    }
                    case 'saveProfile': {
                        const profile = validateProfile(args.profile);
                        if (args.expectedVersion === undefined) throw new Error('Version required.');
                        checkVersion(data.profiles.find(item => item.id === profile.id), args.expectedVersion);
                        data.profiles = [...data.profiles.filter(item => item.id !== profile.id), profile];
                        break;
                    }
                    case 'saveInvoice': {
                        const invoice = validateInvoice(args.invoice);
                        if (args.expectedVersion === undefined) throw new Error('Version required.');
                        if (invoice.profileId !== args.profileId || !data.profiles.some(item => item.id === args.profileId)) throw new Error('Invalid profile.');
                        const existing = data.invoices.find(item => item.id === invoice.id);
                        if (existing && existing.profileId !== args.profileId) throw new Error('Invalid profile.');
                        checkVersion(existing, args.expectedVersion);
                        data.invoices = [...data.invoices.filter(item => item.id !== invoice.id), invoice];
                        break;
                    }
                    case 'restoreProfile': {
                        const backup = parseBackup(args.text);
                        const source = backup.profiles.find(item => item.id === args.sourceId);
                        const target = data.profiles.find(item => item.id === args.targetId);
                        if (!source || !target) throw new Error('Invalid profile.');
                        Object.assign(target, source, {id: target.id, name: target.name});
                        data.invoices = [...data.invoices.filter(item => item.profileId !== target.id), ...backup.invoices.filter(item => item.profileId === source.id)
                            .map(item => ({...item, id: crypto.randomUUID(), profileId: target.id}))];
                        break;
                    }
                    case 'importBrowser': {
                        const backup = parseBackup(args.text);
                        const ids = new Map(backup.profiles.map(item => [item.id, crypto.randomUUID()]));
                        data.profiles.push(...backup.profiles.map(item => ({...item, id: ids.get(item.id)!})));
                        data.invoices.push(...backup.invoices.map(item => ({...item, id: crypto.randomUUID(), profileId: ids.get(item.profileId)!})));
                        data.activeProfileId = ids.get(backup.activeProfileId ?? '') ?? data.activeProfileId;
                        break;
                    }
                    default: throw new Error('Unknown command.');
                }
                return {ok: true};
            }, typeof args.requestId === 'string' ? {id: args.requestId, payload: {name, ...args}} : undefined, ['restoreProfile', 'importBrowser'].includes(name));
            return c.json(result);
        } catch (error) {
            if (error instanceof OperationError) throw error;
            return c.json({error: {code: 'VALIDATION_ERROR', message: error instanceof Error ? error.message : 'Invalid input.'}}, 400);
        }
    });

    const getTools = (store: AccountStore) => createSiteTools({
        context: () => ({ready: true, activeProfileId: null, selectedInvoiceId: null, invoiceDirty: false, profileDirty: false, editingProfileId: null, busy: false}),
        mutate: action => action(),
    }, store.previews, store);
    app.get('/api/tools', async c => {
        const store = await new AccountStore(sql, c.get('user').id).open();
        return c.json(getTools(store).map(({execute, ...tool}) => tool));
    });
    app.post('/api/tools/:name', async c => {
        const store = await new AccountStore(sql, c.get('user').id).open();
        const tool = getTools(store).find(item => item.name === c.req.param('name'));
        if (!tool) return c.json({error: {message: 'Unknown tool.'}}, 404);
        const result = await tool.execute(await c.req.json());
        await store.savePreviews();
        return c.json(result);
    });
    app.all('/mcp', async c => {
        const store = await new AccountStore(sql, c.get('user').id).open();
        const tools = getTools(store);
        const server = new Server({name: 'dacc', version: '1.0.0'}, {capabilities: {tools: {}}});
        server.setRequestHandler(ListToolsRequestSchema, async () => ({tools: tools.map(({execute, ...tool}) => tool)}));
        server.setRequestHandler(CallToolRequestSchema, async request => {
            const tool = tools.find(item => item.name === request.params.name);
            if (!tool) throw new Error('Unknown tool.');
            const result = await tool.execute(request.params.arguments ?? {}) as {ok: boolean};
            await store.savePreviews();
            return {content: [{type: 'text', text: JSON.stringify(result)}], isError: !result.ok};
        });
        const transport = new WebStandardStreamableHTTPServerTransport({sessionIdGenerator: undefined, enableJsonResponse: true});
        await server.connect(transport);
        try { return await transport.handleRequest(c.req.raw); }
        finally { await server.close(); }
    });

    app.get('/api/credentials', async c => c.json(await sql.all('SELECT id, name, created_at, expires_at FROM credentials WHERE user_id = ?', [c.get('user').id])));
    app.post('/api/credentials', async c => {
        const body = await c.req.json();
        if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100) return c.json({error: {message: 'Enter a token name.'}}, 400);
        const token = secret();
        const id = crypto.randomUUID();
        await sql.run('INSERT INTO credentials(id, hash, user_id, name, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
            [id, await hash(token), c.get('user').id, body.name.trim(), Date.now(), Date.now() + 90 * 86400000]);
        return c.json({id, token});
    });
    app.delete('/api/credentials/:id', async c => {
        await sql.run('DELETE FROM credentials WHERE user_id = ? AND id = ?', [c.get('user').id, c.req.param('id')]);
        return c.json({ok: true});
    });
    return app;
}
