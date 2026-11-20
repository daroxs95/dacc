import type {D1Database, Fetcher} from '@cloudflare/workers-types';
import {createApp} from './app';
import type {Settings} from './auth';
import type {Sql} from './sql';

type Bindings = Settings & {DB: D1Database; ASSETS: Fetcher};
export default {
    async fetch(request: Request, env: Bindings): Promise<Response> {
        const sql: Sql = {
            first: <T>(query: string, params: unknown[] = []) => env.DB.prepare(query).bind(...params).first<T>(),
            all: async <T>(query: string, params: unknown[] = []) => (await env.DB.prepare(query).bind(...params).all<T>()).results,
            run: async (query, params = []) => (await env.DB.prepare(query).bind(...params).run()).meta.changes,
        };
        const app = createApp(sql, env);
        app.get('*', c => env.ASSETS.fetch(c.req.raw as never) as unknown as Promise<Response>);
        return app.fetch(request);
    },
};
