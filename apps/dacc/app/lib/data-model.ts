import {checkVersion, OperationError, recordVersion} from "./record-version";
import {invoiceCents} from "./money";

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

export function validateInvoiceAmount(invoice: Pick<InvoiceRecord, "quantity" | "rate">) {
    const cents = invoiceCents(invoice.quantity, invoice.rate);
    if (cents > BigInt(Number.MAX_SAFE_INTEGER) || cents < -BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new OperationError("VALIDATION_ERROR", "Invoice amount is too large.");
    }
}

export function validateProfile(value: unknown): Profile {
    const data = record(value);
    const id = string(data.id);
    const name = string(data.name);
    if (!id.trim() || !name.trim() || typeof data.showLogo !== "boolean" ||
        (data.language !== "es" && data.language !== "en")) throw new Error("Invalid profile.");
    return {id, name, company: company(data.company), language: data.language, showLogo: data.showLogo};
}

export function validateInvoice(value: unknown): InvoiceRecord {
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

export function validateDatabase(value: unknown): Database {
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

