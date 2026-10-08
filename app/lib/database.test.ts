import {beforeEach, test} from "node:test";
import assert from "node:assert/strict";
import {IDBFactory} from "fake-indexeddb";
import {createBackup, loadDatabase, parseBackup, readDatabase, readInvoices, restoreBackup,
    saveProfile, saveInvoice, selectProfile, type Profile, type InvoiceRecord, type Database} from "./database";

const company = {name: "Acme", address: "Street", city: "Paris", country: "France", email: "a@example.com", postalCode: "75001"};
const profile: Profile = {id: "p1", name: "Work", company, language: "en", showLogo: true};
const second: Profile = {...profile, id: "p2", name: "Other company"};
const invoice: InvoiceRecord = {id: "i1", profileId: "p1", invoiceNumber: "001", created: "2026-10-08", due: "2026-11-08",
    description: "Consulting", quantity: 2.5, rate: 99.95, showLogo: true, paid: true,
    company, companyToBill: {...company, name: "Recipient"}, language: "en"};
const legacy = {...invoice, id: "Old profile", paid: undefined};
let storage: Map<string, string>;
beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    storage = new Map();
    Object.defineProperty(globalThis, "localStorage", {configurable: true, value: {
        getItem: (key: string) => storage.get(key) ?? null,
    }});
});

async function seed() {
    const data: Database = {profiles: [profile, second], invoices: [invoice], activeProfileId: profile.id};
    await restoreBackup(createBackup(data));
    return data;
}

test("saving rejects missing invoice numbers without changing stored invoices", async () => {
    const initial = await seed();
    for (const invoiceNumber of ["", "   "]) {
        await assert.rejects(saveInvoice({...invoice, invoiceNumber}, profile.id), /Enter an invoice number/);
        await assert.rejects(saveInvoice({...invoice, id: "new", invoiceNumber}, profile.id), /Enter an invoice number/);
    }
    assert.deepEqual(await readDatabase(), initial);
});

test("fresh install has a selected default profile and no invoices", async () => {
    const data = await loadDatabase();
    assert.equal(data.profiles.length, 1);
    assert.equal(data.activeProfileId, data.profiles[0].id);
    assert.deepEqual(data.invoices, []);
});

test("localStorage migration separates profile and invoice once without losing fields", async () => {
    storage.set("data", JSON.stringify({profiles: [legacy]}));
    const data = await loadDatabase();
    assert.equal(data.profiles[0].name, "Old profile");
    assert.deepEqual(data.invoices[0], {...invoice, id: "legacy:Old profile", profileId: "legacy:Old profile", paid: false});
    await saveInvoice({...data.invoices[0], paid: true}, data.profiles[0].id);
    assert.equal((await loadDatabase()).invoices[0].paid, true);
    assert.ok(storage.has("data"));
});

test("existing IndexedDB v1 upgrades atomically and retains the recovery store", async () => {
    await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("dacc", 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore("profiles", {keyPath: "id"}).add(legacy);
            request.result.createObjectStore("settings").put(true, "migrated");
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {request.result.close(); resolve();};
    });
    const data = await loadDatabase();
    assert.equal(data.profiles.length, 1);
    assert.equal(data.invoices.length, 1);
    assert.equal(data.invoices[0].profileId, data.profiles[0].id);
    assert.equal(data.activeProfileId, data.profiles[0].id);
    assert.deepEqual(await loadDatabase(), data);
});

test("profile lists stay isolated while multiple invoices are created and edited", async () => {
    await seed();
    await saveInvoice({...invoice, id: "i2", invoiceNumber: "002"}, profile.id);
    await saveInvoice({...invoice, id: "i3", profileId: second.id}, second.id);
    await saveInvoice({...invoice, rate: 500}, profile.id);
    assert.deepEqual((await readInvoices(profile.id)).map(item => item.id), ["i1", "i2"]);
    assert.equal((await readInvoices(second.id))[0].rate, 99.95);
    assert.equal((await readInvoices(profile.id))[0].rate, 500);
});

test("active profile survives reopening; renames retain invoice associations and snapshots", async () => {
    await seed();
    await selectProfile(second.id);
    await saveProfile({...profile, name: "Renamed", company: {...company, name: "New issuer"}});
    const data = await loadDatabase();
    assert.equal(data.activeProfileId, second.id);
    assert.equal(data.profiles[0].name, "Renamed");
    assert.deepEqual(data.invoices, [invoice]);
});

test("cross-profile updates and missing owners are rejected without modifying invoices", async () => {
    const initial = await seed();
    await assert.rejects(async () => saveInvoice(invoice, second.id));
    await assert.rejects(saveInvoice({...invoice, profileId: second.id}, second.id));
    await assert.rejects(saveInvoice({...invoice, id: "new", profileId: "missing"}, "missing"));
    await assert.rejects(selectProfile("missing"));
    assert.deepEqual(await readDatabase(), initial);
});

test("v2 backup round trip on another device preserves profiles, invoices and selection", async () => {
    const data = await seed();
    const backup = createBackup(await readDatabase());
    globalThis.indexedDB = new IDBFactory();
    await restoreBackup(backup);
    assert.deepEqual(await loadDatabase(), data);
});

test("v1 backups including unnamed records remain importable", async () => {
    await restoreBackup(JSON.stringify({format: "dacc", version: 1, profiles: [{...legacy, id: ""}]}));
    const data = await readDatabase();
    assert.equal(data.profiles[0].name, "Sin nombre");
    assert.equal(data.invoices[0].profileId, data.profiles[0].id);
    assert.deepEqual(parseBackup(createBackup(data)), data);
});

test("invalid imports leave the entire database intact", async () => {
    const data = await seed();
    const valid = JSON.parse(createBackup(data));
    const bad = ["not json", "null", {...valid, version: 9}, {...valid, profiles: [profile, profile]},
        {...valid, invoices: [invoice, invoice]}, {...valid, invoices: [{...invoice, profileId: "missing"}]},
        {...valid, invoices: [{...invoice, paid: "yes"}]}, {...valid, invoices: [{...invoice, rate: null}]},
        {...valid, activeProfileId: "missing"}, {...valid, profiles: [{...profile, company: null}]}];
    for (const value of bad) {
        await assert.rejects(async () => restoreBackup(typeof value === "string" ? value : JSON.stringify(value)));
        assert.deepEqual(await readDatabase(), data);
    }
});

test("empty restore does not resurrect legacy records", async () => {
    storage.set("data", JSON.stringify({profiles: [legacy]}));
    await loadDatabase();
    const empty = {profiles: [], invoices: [], activeProfileId: null};
    await restoreBackup(createBackup(empty));
    assert.deepEqual(await loadDatabase(), empty);
});

test("broken localStorage is retained and recovery from a backup remains possible", async () => {
    storage.set("data", "broken");
    await assert.rejects(loadDatabase());
    const data = await seed();
    assert.deepEqual(await loadDatabase(), data);
    assert.equal(storage.get("data"), "broken");
});
