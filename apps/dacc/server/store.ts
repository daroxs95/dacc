import type {Sql} from './sql';
import {applyChange, type DataStore, type Receipt, type MutationRequest} from '../app/lib/data-store';
import {blankCompany, type Database} from '../app/lib/data-model';
import {OperationError} from '../app/lib/record-version';
import type {ImportPreviews} from '../app/lib/site-tools';

type Document = {data: Database; receipts: Record<string, Receipt>; previews: Array<[string, ImportPreviews extends Map<string, infer V> ? V : never]>};

export class AccountStore implements DataStore {
    private revision = 0;
    private document!: Document;
    readonly previews: ImportPreviews = new Map();
    constructor(private sql: Sql, private userId: string) {}

    async open() {
        const id = crypto.randomUUID();
        const initial: Document = {data: {profiles: [{id, name: 'Mi perfil', company: blankCompany(), language: 'es', showLogo: true}],
            invoices: [], activeProfileId: id}, receipts: {}, previews: []};
        await this.sql.run('INSERT OR IGNORE INTO workspaces(user_id, document) VALUES (?, ?)', [this.userId, JSON.stringify(initial)]);
        const row = await this.sql.first<{revision: number; document: string}>('SELECT revision, document FROM workspaces WHERE user_id = ?', [this.userId]);
        this.revision = row!.revision;
        this.document = JSON.parse(row!.document);
        for (const [key, value] of this.document.previews) if (value.expiresAt > Date.now()) this.previews.set(key, value);
        return this;
    }

    readDatabase = async () => structuredClone(this.document.data);

    changeRecords = async <T>(change: (data: Database) => T, request?: MutationRequest, allowLegacyDuplicates = false): Promise<T> => {
        const next = structuredClone(this.document);
        const result = applyChange(next.data, change, next.receipts, request, allowLegacyDuplicates);
        await this.commit(next);
        return result;
    };

    async savePreviews() {
        if (JSON.stringify(this.document.previews) !== JSON.stringify([...this.previews])) await this.commit(structuredClone(this.document));
    }

    private async commit(next: Document) {
        next.previews = [...this.previews];
        const changed = await this.sql.run('UPDATE workspaces SET document = ?, revision = revision + 1 WHERE user_id = ? AND revision = ?',
            [JSON.stringify(next), this.userId, this.revision]);
        if (!changed) throw new OperationError('STALE_VERSION', 'Account data changed. Retry the operation using current data.');
        this.revision++;
        this.document = next;
    }
}
