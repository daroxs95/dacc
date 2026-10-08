type LegacyInvoice = {
    id: string;
    invoiceNumber: string;
    created: string;
    due: string;
    description: string;
    quantity: number;
    rate: number;
    showLogo: boolean;
    paid: boolean;
    company: Company;
    companyToBill: Company;
    language: "es" | "en";
};

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid database backup.");
    return value as Record<string, unknown>;
}

function string(value: unknown): string {
    if (typeof value !== "string") throw new Error("Invalid text field in database backup.");
    return value;
}

function company(value: unknown): Company {
    const data = record(value);
    return {
        name: string(data.name), address: string(data.address), city: string(data.city),
        country: string(data.country), email: string(data.email), postalCode: string(data.postalCode),
    };
}

function legacyInvoices(value: unknown, legacy = false): LegacyInvoice[] {
    if (!Array.isArray(value)) throw new Error("The backup must contain profiles.");
    const ids = new Set<string>();
    return value.map(value => {
        const data = record(value);
        const id = string(data.id);
        if ((!legacy && !id.trim()) || ids.has(id)) throw new Error("Profile names must be non-empty and unique.");
        ids.add(id);
        if (typeof data.quantity !== "number" || !Number.isFinite(data.quantity) ||
            typeof data.rate !== "number" || !Number.isFinite(data.rate) ||
            typeof data.showLogo !== "boolean" ||
            !(typeof data.paid === "boolean" || (legacy && data.paid === undefined)) ||
            (data.language !== "es" && data.language !== "en")) {
            throw new Error("Invalid invoice values in database backup.");
        }
        return {
            id, invoiceNumber: string(data.invoiceNumber), created: string(data.created),
            due: string(data.due), description: string(data.description), quantity: data.quantity,
            rate: data.rate, showLogo: data.showLogo, paid: data.paid === true,
            language: data.language, company: company(data.company), companyToBill: company(data.companyToBill),
        };
    });
}

export type Profile = {
    id: string;
    name: string;
    company: Company;
    language: "es" | "en";
    showLogo: boolean;
};
export type InvoiceRecord = LegacyInvoice & {profileId: string};
export type Database = {profiles: Profile[]; invoices: InvoiceRecord[]; activeProfileId: string | null};
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export const blankCompany = (): Company => ({name: "", address: "", city: "", country: "", email: "", postalCode: ""});

function validateProfile(value: unknown): Profile {
    const data = record(value);
    const id = string(data.id);
    const name = string(data.name);
    if (!id.trim() || !name.trim() || typeof data.showLogo !== "boolean" ||
        (data.language !== "es" && data.language !== "en")) throw new Error("Invalid profile.");
    return {id, name, company: company(data.company), language: data.language, showLogo: data.showLogo};
}

function validateInvoice(value: unknown): InvoiceRecord {
    const data = record(value);
    return {...legacyInvoices([data])[0], profileId: string(data.profileId)};
}

function fromLegacy(value: unknown): Database {
    const old = legacyInvoices(value, true);
    const profiles = old.map(invoice => ({id: `legacy:${invoice.id}`, name: invoice.id || "Sin nombre",
        company: invoice.company, language: invoice.language, showLogo: invoice.showLogo}));
    const invoices = old.map(invoice => ({...invoice, id: `legacy:${invoice.id}`, profileId: `legacy:${invoice.id}`}));
    return {profiles, invoices, activeProfileId: profiles[0]?.id ?? null};
}

function validateDatabase(value: unknown): Database {
    const data = record(value);
    if (!Array.isArray(data.profiles) || !Array.isArray(data.invoices)) throw new Error("Invalid database backup.");
    const profiles = data.profiles.map(validateProfile);
    const invoices = data.invoices.map(validateInvoice);
    const ids = new Set(profiles.map(profile => profile.id));
    if (ids.size !== profiles.length || new Set(invoices.map(invoice => invoice.id)).size !== invoices.length)
        throw new Error("Duplicate IDs in database backup.");
    if (invoices.some(invoice => !ids.has(invoice.profileId))) throw new Error("An invoice references a missing profile.");
    const activeProfileId = data.activeProfileId === null ? null : string(data.activeProfileId);
    if (activeProfileId !== null && !ids.has(activeProfileId)) throw new Error("Active profile is missing.");
    return {profiles, invoices, activeProfileId};
}

export function parseBackup(text: string): Database {
    const data = record(JSON.parse(text));
    if (data.format !== "dacc") throw new Error("Choose a DACC database backup.");
    if (data.version === 1) return fromLegacy(data.profiles);
    if (data.version !== 2) throw new Error("Unsupported database backup version.");
    return validateDatabase(data);
}

export function createBackup(data: Database): string {
    return JSON.stringify({format: "dacc", version: 2, exportedAt: new Date().toISOString(), ...validateDatabase(data)}, null, 2);
}

export function createProfileBackup(data: Database, profileId: string): string {
    const profile = data.profiles.find(profile => profile.id === profileId);
    if (!profile) throw new Error("Invalid profile.");
    return createBackup({profiles: [profile], invoices: data.invoices.filter(invoice => invoice.profileId === profileId),
        activeProfileId: profileId});
}

export function restoreProfileBackup(text: string, sourceId: string, targetId: string): Promise<void> {
    const data = parseBackup(text);
    const source = data.profiles.find(profile => profile.id === sourceId);
    if (!source) throw new Error("Invalid profile.");
    const invoices = data.invoices.filter(invoice => invoice.profileId === sourceId)
        .map(invoice => ({...invoice, id: crypto.randomUUID(), profileId: targetId}));
    return transaction("readwrite", tx => {
        const profiles = tx.objectStore("businessProfiles");
        const target = profiles.get(targetId);
        target.onsuccess = () => {
            if (!target.result) { tx.abort(); return; }
            profiles.put({...source, id: targetId, name: target.result.name});
            const store = tx.objectStore("invoices");
            const cursor = store.index("profileId").openCursor(targetId);
            cursor.onsuccess = () => {
                if (cursor.result) {
                    cursor.result.delete();
                    cursor.result.continue();
                } else {
                    invoices.forEach(invoice => store.add(invoice));
                }
            };
            tx.objectStore("settings").put(true, "migrated");
        };
    });
}

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (!globalThis.indexedDB) return reject(new Error("Browser database is unavailable. Enable browser storage and reload."));
        const request = indexedDB.open("dacc", 2);
        let blocked = false;
        let migrationError: unknown;
        request.onupgradeneeded = event => {
            const db = request.result;
            if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
            db.createObjectStore("businessProfiles", {keyPath: "id"});
            db.createObjectStore("invoices", {keyPath: "id"}).createIndex("profileId", "profileId");
            // Preserve the old store as a recovery copy. Schema migration and the
            // copied records commit together or are rolled back together.
            if (event.oldVersion === 1) {
                const tx = request.transaction!;
                const old = tx.objectStore("profiles").getAll();
                old.onsuccess = () => {
                    try {
                        const data = fromLegacy(old.result);
                        data.profiles.forEach(profile => tx.objectStore("businessProfiles").add(profile));
                        data.invoices.forEach(invoice => tx.objectStore("invoices").add(invoice));
                        tx.objectStore("settings").put(data.activeProfileId, "activeProfileId");
                    } catch (error) { migrationError = error; tx.abort(); }
                };
            }
        };
        request.onerror = () => reject(migrationError ?? request.error);
        request.onblocked = () => {
            blocked = true;
            reject(new Error("Close other DACC tabs and reload to update the database."));
        };
        request.onsuccess = () => {
            if (blocked) return request.result.close();
            request.result.onversionchange = () => request.result.close();
            resolve(request.result);
        };
    });
}

async function transaction<T>(mode: IDBTransactionMode, run: (tx: IDBTransaction, result: (value: T) => void) => void): Promise<T> {
    const db = await openDatabase();
    return new Promise<T>((resolve, reject) => {
        const tx = db.transaction(["businessProfiles", "invoices", "settings"], mode);
        let value: T;
        tx.oncomplete = () => { db.close(); resolve(value); };
        tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Database operation failed; no changes were saved.")); };
        try { run(tx, result => { value = result; }); }
        catch (error) { tx.abort(); reject(error); }
    });
}

export async function loadDatabase(): Promise<Database> {
    const migrated = await transaction<boolean>("readonly", (tx, result) => {
        const request = tx.objectStore("settings").get("migrated");
        request.onsuccess = () => result(Boolean(request.result));
    });
    if (!migrated) {
        const legacy = localStorage.getItem("data");
        const data = legacy ? fromLegacy(record(JSON.parse(legacy)).profiles) : {
            profiles: [{id: "default", name: "Mi perfil", company: blankCompany(), language: "es" as const, showLogo: true}],
            invoices: [], activeProfileId: "default",
        };
        await transaction<void>("readwrite", tx => {
            const settings = tx.objectStore("settings");
            const request = settings.get("migrated");
            request.onsuccess = () => {
                if (request.result) return;
                data.profiles.forEach(profile => tx.objectStore("businessProfiles").put(profile));
                data.invoices.forEach(invoice => tx.objectStore("invoices").put(invoice));
                settings.put(data.activeProfileId, "activeProfileId");
                settings.put(true, "migrated");
            };
        });
    }
    return readDatabase();
}

export function readDatabase(): Promise<Database> {
    return transaction("readonly", (tx, result) => {
        const data: Database = {profiles: [], invoices: [], activeProfileId: null};
        const profiles = tx.objectStore("businessProfiles").getAll();
        const invoices = tx.objectStore("invoices").getAll();
        const active = tx.objectStore("settings").get("activeProfileId");
        profiles.onsuccess = () => { data.profiles = profiles.result; };
        invoices.onsuccess = () => { data.invoices = invoices.result; };
        active.onsuccess = () => { data.activeProfileId = active.result ?? null; };
        result(data);
    });
}

export function readInvoices(profileId: string): Promise<InvoiceRecord[]> {
    return transaction("readonly", (tx, result) => {
        const request = tx.objectStore("invoices").index("profileId").getAll(profileId);
        request.onsuccess = () => result(request.result);
    });
}

export function selectProfile(id: string): Promise<void> {
    return transaction("readwrite", tx => {
        const request = tx.objectStore("businessProfiles").get(id);
        request.onsuccess = () => {
            if (!request.result) { tx.abort(); return; }
            tx.objectStore("settings").put(id, "activeProfileId");
        };
    });
}

export function saveProfile(profile: Profile): Promise<void> {
    const validated = validateProfile(profile);
    return transaction("readwrite", tx => {
        tx.objectStore("businessProfiles").put(validated);
    });
}

export function saveInvoice(invoice: InvoiceRecord, profileId: string): Promise<void> {
    const validated = validateInvoice(invoice);
    if (!validated.invoiceNumber.trim()) return Promise.reject(new Error("Enter an invoice number."));
    if (validated.profileId !== profileId) return Promise.reject(new Error("Invoice does not belong to the selected profile."));
    return transaction("readwrite", tx => {
        const owner = tx.objectStore("businessProfiles").get(profileId);
        owner.onsuccess = () => {
            if (!owner.result) { tx.abort(); return; }
            const store = tx.objectStore("invoices");
            const existing = store.get(validated.id);
            existing.onsuccess = () => {
                if (existing.result && existing.result.profileId !== profileId) { tx.abort(); return; }
                store.put(validated);
            };
        };
    });
}

export function restoreBackup(text: string): Promise<void> {
    const data = parseBackup(text);
    return transaction("readwrite", tx => {
        tx.objectStore("businessProfiles").clear();
        tx.objectStore("invoices").clear();
        data.profiles.forEach(profile => tx.objectStore("businessProfiles").add(profile));
        data.invoices.forEach(invoice => tx.objectStore("invoices").add(invoice));
        tx.objectStore("settings").put(data.activeProfileId, "activeProfileId");
        tx.objectStore("settings").put(true, "migrated");
    });
}
