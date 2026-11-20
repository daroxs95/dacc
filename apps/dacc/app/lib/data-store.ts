import {validateDatabase, validateInvoiceAmount, type Database} from './data-model';
import {OperationError, recordVersion} from './record-version';

export type MutationRequest = {id: string; payload: unknown};
export type Receipt = {payload: string; result: unknown; records: Array<{kind: 'profiles' | 'invoices'; id: string; version: string}>};
export type DataStore = {
    readDatabase: () => Promise<Database>;
    changeRecords: <T>(change: (data: Database) => T, request?: MutationRequest) => Promise<T>;
};

export function applyChange<T>(data: Database, change: (data: Database) => T, receipts: Record<string, Receipt>, request?: MutationRequest, allowLegacyDuplicates = false) {
    const receiptKey = `request:${request?.id}`;
    const old = request && receipts[receiptKey];
    if (old) {
        if (old.payload !== recordVersion(request!.payload)) throw new OperationError('REQUEST_CONFLICT', 'Request ID already used with different content.');
        for (const entry of old.records) {
            const current = data[entry.kind].find(item => item.id === entry.id);
            if (!current || recordVersion(current) !== entry.version) throw new OperationError('STALE_REQUEST', 'The original result changed.');
        }
        return old.result as T;
    }
    const before = structuredClone(data);
    const result = change(data);
    const validated = validateDatabase(data);
    const changed: Receipt['records'] = [];
    for (const kind of ['profiles', 'invoices'] as const) {
        for (const item of validated[kind]) {
            if (recordVersion(before[kind].find(old => old.id === item.id)) === recordVersion(item)) continue;
            changed.push({kind, id: item.id, version: recordVersion(item)});
        }
    }
    for (const invoice of validated.invoices) {
        const previous = before.invoices.find(item => item.id === invoice.id);
        if (recordVersion(previous) === recordVersion(invoice)) continue;
        validateInvoiceAmount(invoice);
        if (!invoice.invoiceNumber.trim()) throw new OperationError('VALIDATION_ERROR', 'Enter an invoice number.');
        if (!allowLegacyDuplicates && previous?.invoiceNumber !== invoice.invoiceNumber && validated.invoices.some(item => item.id !== invoice.id &&
            item.profileId === invoice.profileId && item.invoiceNumber.trim() === invoice.invoiceNumber.trim())) {
            throw new OperationError('DUPLICATE_INVOICE', 'This invoice number already exists in the profile.');
        }
    }
    if (request) receipts[receiptKey] = {payload: recordVersion(request.payload), result, records: changed};
    return result;
}
