import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {AccountStore} from './store';
import type {Sql} from './sql';
import {createSiteTools} from '../app/lib/site-tools';

// Node's built-in SQLite lets these persistence tests run without a native addon.
const {DatabaseSync} = createRequire(import.meta.url)('node:sqlite');
function fixture() {
    const database = new DatabaseSync(':memory:');
    database.exec(readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));
    database.exec("INSERT INTO users VALUES ('a', 'google-a', 'a@example.com', 'A'), ('b', 'google-b', 'b@example.com', 'B')");
    const sql: Sql = {
        first: async (query, params = []) => database.prepare(query).get(...params) ?? null,
        all: async (query, params = []) => database.prepare(query).all(...params),
        run: async (query, params = []) => Number(database.prepare(query).run(...params).changes),
    };
    return {sql, database};
}
test('SQL isolates accounts and persists changes across store instances', async () => {
    const {sql, database} = fixture();
    try {
        const a = await new AccountStore(sql, 'a').open();
        await a.changeRecords(data => { data.profiles[0].name = 'A company'; });
        const b = await new AccountStore(sql, 'b').open();
        assert.equal((await b.readDatabase()).profiles[0].name, 'Mi perfil');
        assert.equal((await (await new AccountStore(sql, 'a').open()).readDatabase()).profiles[0].name, 'A company');
    } finally { database.close(); }
});
test('SQL compare-and-swap rejects concurrent updates without losing the winner', async () => {
    const {sql, database} = fixture();
    try {
        const first = await new AccountStore(sql, 'a').open();
        const second = await new AccountStore(sql, 'a').open();
        await first.changeRecords(data => { data.profiles[0].name = 'Winner'; });
        await assert.rejects(second.changeRecords(data => { data.profiles[0].name = 'Loser'; }), {code: 'STALE_VERSION'});
        assert.equal((await (await new AccountStore(sql, 'a').open()).readDatabase()).profiles[0].name, 'Winner');
    } finally { database.close(); }
});
test('SQL receipts survive retries and reject changed request payloads', async () => {
    const {sql, database} = fixture();
    try {
        const store = await new AccountStore(sql, 'a').open();
        const request = {id: '__proto__', payload: {name: 'Renamed'}};
        await store.changeRecords(data => { data.profiles[0].name = 'Renamed'; return 42; }, request);
        const reopened = await new AccountStore(sql, 'a').open();
        assert.equal(await reopened.changeRecords(() => { throw new Error('Should not repeat'); }, request), 42);
        await assert.rejects(reopened.changeRecords(() => {}, {...request, payload: {name: 'Different'}}), {code: 'REQUEST_CONFLICT'});
    } finally { database.close(); }
});
test('import previews persist across requests and remain account scoped', async () => {
    const {sql, database} = fixture();
    const bridge = {context: () => ({ready: true, activeProfileId: null, selectedInvoiceId: null, invoiceDirty: false, profileDirty: false, editingProfileId: null, busy: false}), mutate: (action: () => Promise<unknown>) => action()};
    try {
        const first = await new AccountStore(sql, 'a').open();
        const profile = (await first.readDatabase()).profiles[0];
        const previewTool = createSiteTools(bridge, first.previews, first).find(tool => tool.name === 'dacc_preview_import')!;
        const result = await previewTool.execute({profileId: profile.id, invoices: [{invoiceNumber: '001', created: '', due: '', description: '', quantity: 1, rate: 100, paid: false, companyToBill: profile.company}]}) as {data: {previewId: string}};
        await first.savePreviews();
        const next = await new AccountStore(sql, 'a').open();
        const apply = createSiteTools(bridge, next.previews, next).find(tool => tool.name === 'dacc_apply_import')!;
        assert.equal((await apply.execute({previewId: result.data.previewId}) as {ok: boolean}).ok, true);
        assert.equal((await apply.execute({previewId: result.data.previewId}) as {ok: boolean}).ok, true);
        assert.equal((await next.readDatabase()).invoices.length, 1);
        const other = await new AccountStore(sql, 'b').open();
        assert.equal(other.previews.size, 0);
    } finally { database.close(); }
});

test('profile deletion persists through MCP tool requests, is account scoped and rejects concurrent writes', async () => {
    const {sql, database} = fixture();
    const bridge = {context: () => ({ready: true, activeProfileId: null, selectedInvoiceId: null, invoiceDirty: false, profileDirty: false, editingProfileId: null, busy: false}), mutate: (action: () => Promise<unknown>) => action()};
    const call = async (store: AccountStore, name: string, args: unknown) =>
        await createSiteTools(bridge, store.previews, store).find(tool => tool.name === 'dacc_' + name)!.execute(args) as {ok: boolean; data: {version: string}; error?: {code: string}};
    try {
        const a = await new AccountStore(sql, 'a').open();
        const original = (await a.readDatabase()).profiles[0];
        await a.changeRecords(data => { data.profiles.push({...original, id: 'empty', name: 'Empty'}); });
        const preview = await call(a, 'preview_profile_deletion', {profileId: 'empty'});
        const args = {profileId: 'empty', expectedVersion: preview.data.version, requestId: 'delete-empty', emptyOnly: true};
        const b = await new AccountStore(sql, 'b').open();
        assert.equal((await call(b, 'delete_profile', args)).error?.code, 'NOT_FOUND');
        const stale = await new AccountStore(sql, 'a').open();
        await a.changeRecords(data => { data.profiles[0].name = 'Retained'; });
        assert.equal((await call(stale, 'delete_profile', args)).error?.code, 'STALE_VERSION');
        const fresh = await new AccountStore(sql, 'a').open();
        assert.equal((await call(fresh, 'delete_profile', args)).ok, true);
        const reopened = await new AccountStore(sql, 'a').open();
        assert.equal((await call(reopened, 'delete_profile', args)).ok, true);
        assert.deepEqual((await reopened.readDatabase()).profiles, [{...original, name: 'Retained'}]);
        assert.equal((await b.readDatabase()).profiles.length, 1);
    } finally { database.close(); }
});
