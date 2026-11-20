import {OperationError} from './record-version';
import type {Database, Profile, InvoiceRecord} from './data-model';
export * from './data-model';
export async function api<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
    const response = await fetch(path, {method, headers: body === undefined ? undefined : {'Content-Type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)});
    const result = await response.json();
    if (!response.ok) {
        const failure = result as {error?: {code?: string; message?: string}} | null;
        throw new OperationError(failure?.error?.code ?? 'OPERATION_FAILED', failure?.error?.message ?? 'Request failed.');
    }
    return result as T;
}
export const readDatabase = () => api<Database>('/api/database');
export const loadDatabase = readDatabase;
export const readInvoices = async (profileId: string) => (await readDatabase()).invoices.filter(item => item.profileId === profileId);
export const selectProfile = (id: string) => api<void>('/api/command/selectProfile', {id});
export const saveProfile = (profile: Profile, expectedVersion?: string | null) => api<void>('/api/command/saveProfile', {profile, expectedVersion: expectedVersion ?? null});
export const saveInvoice = (invoice: InvoiceRecord, profileId: string, expectedVersion?: string | null) => api<void>('/api/command/saveInvoice', {invoice, profileId, expectedVersion: expectedVersion ?? null});
export const restoreProfileBackup = (text: string, sourceId: string, targetId: string) => api<void>('/api/command/restoreProfile', {text, sourceId, targetId, requestId: crypto.randomUUID()});

export async function runTool<T>(name: string, input: unknown): Promise<T> {
    const result = await api<{ok: true; data: T} | {ok: false; error: {code: string; message: string}}>('/api/tools/dacc_' + name, input);
    if (!result.ok) throw new OperationError(result.error.code, result.error.message);
    return result.data;
}
export type ProfileDeletionPreview = {profileId: string; name: string; invoiceCount: number; expenseCount: number;
    hasCompanyDetails: boolean; empty: boolean; canDelete: boolean; version: string};
