import Database from 'better-sqlite3';
import {serve} from '@hono/node-server';
import {serveStatic} from '@hono/node-server/serve-static';
import {mkdirSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from './app';
import type {Sql} from './sql';

const root = fileURLToPath(new URL('../', import.meta.url));
const filename = resolve(process.env.DATABASE_PATH ?? './data/dacc.sqlite');
mkdirSync(dirname(filename), {recursive: true});
const database = new Database(filename);
database.pragma('journal_mode = WAL');
database.pragma('foreign_keys = ON');
database.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)');
for (const name of readdirSync(resolve(root, 'migrations')).filter(name => name.endsWith('.sql')).sort()) {
    if (database.prepare('SELECT name FROM migrations WHERE name = ?').get(name)) continue;
    database.transaction(() => {
        database.exec(readFileSync(resolve(root, 'migrations', name), 'utf8'));
        database.prepare('INSERT INTO migrations(name) VALUES (?)').run(name);
    })();
}
const sql: Sql = {
    first: async <T>(query: string, params: unknown[] = []) => (database.prepare(query).get(...params) as T) ?? null,
    all: async <T>(query: string, params: unknown[] = []) => database.prepare(query).all(...params) as T[],
    run: async (query, params = []) => database.prepare(query).run(...params).changes,
};
const app = createApp(sql, {APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '', GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? ''});
app.use('*', serveStatic({root: resolve(root, 'build/client')}));
app.get('*', serveStatic({path: resolve(root, 'build/client/index.html')}));
serve({fetch: app.fetch, port: Number(process.env.PORT ?? 3000), hostname: process.env.HOST ?? '0.0.0.0'});
