import {api} from './database';
import {createSiteTools, type WorkspaceBridge} from './site-tools';
import type {DataStore} from './data-store';
import {OperationError} from './record-version';
// Local definitions provide schemas. All execution and persistence happen on the server.
const unavailable = async (): Promise<never> => { throw new Error('Remote operation required.'); };
const remoteStore: DataStore = {readDatabase: unavailable, changeRecords: unavailable};
export function createRemoteTools(bridge: WorkspaceBridge) {
    return createSiteTools(bridge, new Map(), remoteStore).map(tool => ({...tool, execute: async (input: unknown) => {
        if (tool.name === 'dacc_get_context') return tool.execute(input);
        const args = input as {invoiceId?: string; profileId?: string};
        const state = bridge.context();
        if (!tool.annotations.readOnlyHint && ((state.invoiceDirty && args?.invoiceId === state.selectedInvoiceId) ||
            (state.profileDirty && args?.profileId === state.editingProfileId))) {
            return {ok: false, error: {code: 'EDITOR_CONFLICT', message: 'Save or discard unsaved edits before retrying.'}};
        }
        const action = () => api('/api/tools/' + tool.name, input);
        try { return tool.annotations.readOnlyHint ? await action() : await bridge.mutate(action); }
        catch (error) { return {ok: false, error: {code: error instanceof OperationError ? error.code : 'OPERATION_FAILED', message: error instanceof Error ? error.message : 'Request failed.'}}; }
    }}));
}
