import {beforeEach, test} from "node:test";
import assert from "node:assert/strict";
import {IDBFactory} from "fake-indexeddb";
import {changeRecords, createBackup, readDatabase, restoreBackup, saveInvoice, saveProfile, type InvoiceRecord, type Profile} from "./database";
import {createSiteTools, type WorkspaceContext} from "./site-tools";
import {recordVersion} from "./record-version";

const company = {name: "Example", address: "", city: "", country: "", email: "", postalCode: ""};
const profile: Profile = {id: "p1", name: "One", company, language: "en", showLogo: false};
const invoice: InvoiceRecord = {id: "i1", profileId: "p1", invoiceNumber: "001", created: "08/10/2026", due: "Unspecified",
    quantity: 1, rate: 1.005, description: "Service", paid: false, company, companyToBill: company, language: "en", showLogo: false};
const {id: _id, profileId: _profileId, ...inputInvoice} = invoice;
let state: WorkspaceContext;
let tools: ReturnType<typeof createSiteTools>;
type Response<T> = {ok: true; data: T} | {ok: false; error: {code: string; message: string}};
async function invoke<T>(name: string, input: unknown): Promise<Response<T>> {
    return await tools.find(tool => tool.name === `dacc_${name}`)!.execute(input) as Response<T>;
}
async function success<T>(name: string, input: unknown): Promise<T> {
    const result = await invoke<T>(name, input);
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.data;
}
async function failure(name: string, input: unknown, code: string) {
    const result = await invoke(name, input);
    assert.equal(result.ok, false, JSON.stringify(result));
    if (!result.ok) assert.equal(result.error.code, code);
}
beforeEach(async () => {
    globalThis.indexedDB = new IDBFactory();
    await restoreBackup(createBackup({profiles: [profile, {...profile, id: "p2", name: "Two"}], invoices: [invoice], activeProfileId: "p1"}));
    state = {ready: true, activeProfileId: "p1", selectedInvoiceId: null, invoiceDirty: false, profileDirty: false, editingProfileId: null, busy: false};
    tools = createSiteTools({context: () => state, mutate: action => action()});
});

test("tool schemas reject unknown fields, nonfinite amounts and ownership changes", async () => {
    const before = await readDatabase();
    await failure("get_context", {unexpected: true}, "VALIDATION_ERROR");
    await failure("search_invoices", {profileId: "p1", limit: 101}, "VALIDATION_ERROR");
    await failure("create_invoice", {profileId: "p1", requestId: "x", invoice: {...inputInvoice, currency: "EUR"}}, "VALIDATION_ERROR");
    await failure("create_invoice", {profileId: "p1", requestId: "x", invoice: {...inputInvoice, rate: Infinity}}, "VALIDATION_ERROR");
    await failure("update_invoice", {profileId: "p1", invoiceId: "i1", expectedVersion: recordVersion(invoice), patch: {profileId: "p2"}}, "VALIDATION_ERROR");
    await failure("get_invoice", {profileId: "p2", invoiceId: "i1"}, "NOT_FOUND");
    assert.deepEqual(await readDatabase(), before);
});

test("search is scoped and paginated; summaries include every match with exact rounded amounts", async () => {
    await saveInvoice({...invoice, id: "i2", invoiceNumber: "002", rate: 2.005, paid: true}, "p1");
    await saveInvoice({...invoice, id: "other", profileId: "p2", rate: 999}, "p2");
    const page = await success<{invoices: {id: string}[]; nextAfterId: string; totalMatches: number}>("search_invoices", {profileId: "p1", limit: 1});
    assert.equal(page.totalMatches, 2);
    assert.deepEqual(page.invoices.map(item => item.id), ["i1"]);
    const next = await success<{invoices: {id: string}[]; nextAfterId: null}>("search_invoices", {profileId: "p1", afterId: page.nextAfterId, limit: 1});
    assert.deepEqual(next.invoices.map(item => item.id), ["i2"]);
    assert.equal(next.nextAfterId, null);
    const summary = await success<{count: number; total: string; outstanding: string}>("summarize_invoices", {profileId: "p1"});
    assert.equal(summary.count, 2);
    assert.equal(summary.total, "3.02");
    assert.equal(summary.outstanding, "1.01");
});

test("concurrent create retries commit one invoice and reject reuse for different input", async () => {
    const args = {profileId: "p1", requestId: "create-1", invoice: {...inputInvoice, invoiceNumber: "002"}};
    const [a, b] = await Promise.all([success("create_invoice", args), success("create_invoice", args)]);
    assert.deepEqual(a, b);
    assert.equal((await readDatabase()).invoices.length, 2);
    await failure("create_invoice", {...args, invoice: {...args.invoice, rate: 10}}, "REQUEST_CONFLICT");
    await failure("create_invoice", {...args, requestId: "different"}, "DUPLICATE_INVOICE");
});

test("create inherits current profile defaults and does not switch active profile", async () => {
    const {company: _company, language: _language, showLogo: _showLogo, ...fields} = inputInvoice;
    const result = await success<{invoice: InvoiceRecord}>("create_invoice", {profileId: "p2", requestId: "new", invoice: {...fields, invoiceNumber: "002"}});
    assert.deepEqual(result.invoice.company, company);
    assert.equal(result.invoice.profileId, "p2");
    assert.equal((await readDatabase()).activeProfileId, "p1");
});

test("concurrent updates using the same version allow exactly one writer", async () => {
    const args = {profileId: "p1", invoiceId: "i1", expectedVersion: recordVersion(invoice)};
    const results = await Promise.all([invoke("update_invoice", {...args, patch: {rate: 20}}), invoke("update_invoice", {...args, patch: {rate: 30}})]);
    assert.equal(results.filter(result => result.ok).length, 1);
    assert.equal(results.filter(result => !result.ok && result.error.code === "STALE_VERSION").length, 1);
    await assert.rejects(saveInvoice({...invoice, description: "Stale manual save"}, "p1", recordVersion(invoice)), /record changed/);
});

test("unsaved invoice and profile forms block only their own records", async () => {
    state.selectedInvoiceId = "i1"; state.invoiceDirty = true;
    await failure("update_invoice", {profileId: "p1", invoiceId: "i1", expectedVersion: recordVersion(invoice), patch: {paid: true}}, "EDITOR_CONFLICT");
    state.editingProfileId = "p1"; state.profileDirty = true;
    await failure("update_profile", {profileId: "p1", expectedVersion: recordVersion(profile), patch: {name: "Changed"}}, "EDITOR_CONFLICT");
    await success("create_invoice", {profileId: "p2", requestId: "other", invoice: inputInvoice});
    assert.deepEqual((await readDatabase()).invoices.find(item => item.id === "i1"), invoice);
});

test("profile edits preserve invoice snapshots and stale manual profile saves fail", async () => {
    await success("update_profile", {profileId: "p1", expectedVersion: recordVersion(profile), patch: {company: {...company, name: "New issuer"}}});
    assert.deepEqual((await readDatabase()).invoices[0].company, company);
    await assert.rejects(saveProfile({...profile, name: "Stale"}, recordVersion(profile)), /record changed/);
});

test("restoring after a create retires its request instead of resurrecting the record", async () => {
    const before = await readDatabase();
    const args = {profileId: "p1", requestId: "retired", invoice: {...inputInvoice, invoiceNumber: "002"}};
    await success("create_invoice", args);
    await restoreBackup(createBackup(before));
    await failure("create_invoice", args, "STALE_REQUEST");
    assert.deepEqual(await readDatabase(), before);
});

test("preview import skips exact duplicates, then applies additions atomically and idempotently", async () => {
    const before = await readDatabase();
    const preview = await success<{previewId: string; canApply: boolean; additions: unknown[]; skippedInvoiceNumbers: string[]}>("preview_import",
        {profileId: "p1", invoices: [inputInvoice, {...inputInvoice, invoiceNumber: "002"}]});
    assert.equal(preview.canApply, true);
    assert.equal(preview.additions.length, 1);
    assert.deepEqual(preview.skippedInvoiceNumbers, ["001"]);
    assert.deepEqual(await readDatabase(), before);
    const first = await success("apply_import", {previewId: preview.previewId});
    assert.deepEqual(await success("apply_import", {previewId: preview.previewId}), first);
    assert.equal((await readDatabase()).invoices.length, 2);
});

test("conflicting or stale import previews never modify the destination", async () => {
    const conflict = await success<{previewId: string; canApply: boolean}>("preview_import", {profileId: "p1", invoices: [{...inputInvoice, rate: 999}]});
    assert.equal(conflict.canApply, false);
    await failure("apply_import", {previewId: conflict.previewId}, "IMPORT_CONFLICT");
    const preview = await success<{previewId: string}>("preview_import", {profileId: "p1", invoices: [{...inputInvoice, invoiceNumber: "002"}]});
    await saveProfile({...profile, name: "Renamed"});
    const before = await readDatabase();
    await failure("apply_import", {previewId: preview.previewId}, "STALE_VERSION");
    assert.deepEqual(await readDatabase(), before);
    await failure("apply_import", {previewId: "unknown"}, "PREVIEW_EXPIRED");
});

test("invalid batches and duplicate numbers inside a batch do not partially import", async () => {
    const before = await readDatabase();
    await failure("preview_import", {profileId: "p1", invoices: [{...inputInvoice, invoiceNumber: "002"}, {...inputInvoice, items: []}]}, "VALIDATION_ERROR");
    const preview = await success<{previewId: string; canApply: boolean}>("preview_import", {profileId: "p1", invoices: [
        {...inputInvoice, invoiceNumber: "002"}, {...inputInvoice, invoiceNumber: "002", rate: 42}]});
    assert.equal(preview.canApply, false);
    await failure("apply_import", {previewId: preview.previewId}, "IMPORT_CONFLICT");
    assert.deepEqual(await readDatabase(), before);
});

test("transaction abort rolls back earlier writes and does not consume its request ID", async () => {
    const before = await readDatabase();
    await assert.rejects(changeRecords(data => {
        data.profiles[0].name = "Must roll back";
        data.invoices.push({...invoice, id: "new", invoiceNumber: ""});
        return {saved: true};
    }, {id: "rollback", payload: {}}), /invoice number/);
    assert.deepEqual(await readDatabase(), before);
    await success("create_invoice", {profileId: "p1", requestId: "rollback", invoice: {...inputInvoice, invoiceNumber: "002"}});
});

test("manual creates also reject duplicate numbers and excessive amounts", async () => {
    const before = await readDatabase();
    await assert.rejects(saveInvoice({...invoice, id: "new"}, "p1", null), /number already exists/);
    await assert.rejects(saveInvoice({...invoice, id: "new", invoiceNumber: "002", rate: 1e308}, "p1", null), /too large/);
    assert.deepEqual(await readDatabase(), before);
});

test("preview handles expire and profile creation retries do not duplicate profiles", async () => {
    const previews = new Map();
    tools = createSiteTools({context: () => state, mutate: action => action()}, previews);
    const preview = await success<{previewId: string}>("preview_import", {profileId: "p1", invoices: [{...inputInvoice, invoiceNumber: "002"}]});
    previews.get(preview.previewId).expiresAt = 0;
    await failure("apply_import", {previewId: preview.previewId}, "PREVIEW_EXPIRED");
    const {id: _id, ...input} = profile;
    const args = {requestId: "profile-create", profile: input};
    const first = await success("create_profile", args);
    assert.deepEqual(await success("create_profile", args), first);
    assert.equal((await readDatabase()).profiles.length, 3);
});
