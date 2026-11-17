import {useEffect, useState, type ReactNode} from 'react';
import {api, createBackup} from '../lib/database';
import {useLang} from '../hooks/useLang';

type User = {id: string; email: string; name: string};
type Credential = {id: string; name: string; expires_at: number};

export function Account({children}: {children: ReactNode}) {
    const {t} = useLang();
    const [user, setUser] = useState<User | null>();
    const [error, setError] = useState('');
    const [open, setOpen] = useState(false);
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [name, setName] = useState('');
    const [token, setToken] = useState('');
    const [busy, setBusy] = useState(false);
    const [generation, setGeneration] = useState(0);
    useEffect(() => { void api<User>('/api/me').then(setUser).catch(error => {
        if (error.code === 'UNAUTHENTICATED') setUser(null);
        else setError(error.message);
    }); }, []);
    const perform = async (action: () => Promise<void>) => {
        setBusy(true); setError('');
        try { await action(); } catch (error) { setError(error instanceof Error ? error.message : t('The operation failed.')); }
        finally { setBusy(false); }
    };
    if (user === undefined) return <main className="container p-4"><p role="status">{error || t('Loading your account.')}</p></main>;
    if (!user) return <main className="container p-4"><h1>DACC</h1><a href="/auth/google">{t('Continue with Google')}</a></main>;
    return <>
        <div className="noPrint hstack f-wrap">
            <button className="secondary compact" onClick={() => void perform(async () => {
                setCredentials(await api<Credential[]>('/api/credentials')); setOpen(!open); setToken('');
            })}>{user.email}</button>
            <button className="secondary compact" disabled={busy} onClick={() => {
                if (window.confirm(t('Sign out and discard unsaved changes?'))) void perform(async () => {
                    await api('/auth/logout', {}); setToken(''); setUser(null);
                });
            }}>{t('Sign out')}</button>
        </div>
        {open && <section className="noPrint container p-4" aria-label={t('Account settings')}>
            <h2>{t('Account settings')}</h2>
            <button disabled={busy} onClick={() => {
                if (!window.confirm(t('Import this browser’s profiles into your account and discard unsaved changes?'))) return;
                void perform(async () => {
                    const legacy = await import('../lib/legacy-database');
                    const text = createBackup(await legacy.loadDatabase());
                    // The backup content identifies the import across retries and browser sessions.
                    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(JSON.parse(text), (key, value) => key === 'exportedAt' ? undefined : value)));
                    const requestId = 'browser:' + Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
                    await api('/api/command/importBrowser', {text: JSON.stringify({...JSON.parse(text), exportedAt: undefined}), requestId});
                    setGeneration(value => value + 1); setOpen(false);
                });
            }}>{t('Import browser data')}</button>
            <h3>{t('MCP access tokens')}</h3>
            <p>{t('Tokens expire after 90 days and allow reading and editing your account data.')}</p>
            <form onSubmit={event => { event.preventDefault(); void perform(async () => {
                const created = await api<{token: string}>('/api/credentials', {name});
                setToken(created.token); setName(''); setCredentials(await api<Credential[]>('/api/credentials'));
            }); }}>
                <label className="form-field">{t('Token name')}<input required maxLength={100} value={name} onChange={event => setName(event.target.value)}/></label>
                <button disabled={busy}>{t('Create token')}</button>
            </form>
            {token && <label className="form-field">{t('Copy this token now. It is shown once.')}<input readOnly value={token} onFocus={event => event.target.select()}/></label>}
            <ul>{credentials.map(item => <li key={item.id}>{item.name} <button disabled={busy} className="secondary compact" onClick={() => void perform(async () => {
                await api('/api/credentials/' + item.id, undefined, 'DELETE'); setCredentials(await api<Credential[]>('/api/credentials'));
            })}>{t('Revoke')}</button></li>)}</ul>
        </section>}
        {error && <p role="alert">{error}</p>}
        <div key={generation}>{children}</div>
    </>;
}
