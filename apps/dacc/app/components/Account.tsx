import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {api} from '../lib/database';
import {useLang} from '../hooks/useLang';
import styles from './Account.module.css';

type User = {id: string; email: string; name: string};
type Credential = {id: string; name: string; expires_at: number};

const AccountActionsContext = createContext<ReactNode>(null);

export function AccountActions() {
    return <>{useContext(AccountActionsContext)}</>;
}

export function Account({children}: {children: ReactNode}) {
    const {t, language, setLanguage} = useLang();
    const [user, setUser] = useState<User | null>();
    const [error, setError] = useState('');
    const accountDialog = useRef<HTMLDialogElement>(null);
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [name, setName] = useState('');
    const [token, setToken] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => { void api<User>('/api/me').then(setUser).catch(error => {
        if (error.code === 'UNAUTHENTICATED') setUser(null);
        else setError(error.message);
    }); }, []);
    const perform = async (action: () => Promise<void>) => {
        setBusy(true); setError('');
        try { await action(); } catch (error) { setError(error instanceof Error ? error.message : t('The operation failed.')); }
        finally { setBusy(false); }
    };
    if (!user) return <div className={styles.loginPage}>
        <header className={styles.loginHeader}>
            <a className="workspace-brand" href="/" aria-label="DACC"><span className="workspace-monogram" aria-hidden="true">d.</span>DACC</a>
            <label className={styles.language}><span className={styles.languageLabel}>{t('Language')}</span>
                <select aria-label={t('Language')} value={language} onChange={event => setLanguage(event.target.value as 'en' | 'es')}><option value="en">English</option><option value="es">Español</option></select>
            </label>
        </header>
        <main className={styles.loginMain}>
            <section className={styles.loginCard} aria-labelledby="login-title">
                <h1 id="login-title">{t('Log in to DACC')}</h1>
                <p className={styles.intro}>{t('Your invoices, all in one place.')}</p>
                {user === undefined ? <p className={styles.loginStatus} role="status">{error || t('Loading your account.')}</p> : <>
                    <a className="button secondary" href="/auth/google"><span className={styles.googleButton}>
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.8-1.76-5.59-4.13H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.11-1.32.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.51l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.71 9.4 5.95 12 5.95Z"/></svg>
                        {t('Continue with Google')}
                    </span></a>
                    <p className={styles.loginNote}>{t('Use your Google account to sign in or get started.')}</p>
                </>}
                <div className={styles.loginDetails}><h2>{t('Simple invoicing. One account.')}</h2><p>{t('Create invoices, keep track of payments, and access your work from any device.')}</p></div>
            </section>
            <p className={styles.loginFooter}>{t('Your invoices are only visible to your account.')}</p>
        </main>
        <footer className={styles.pageFooter}>DACC · {t('Simple invoicing')}</footer>
    </div>;
    return <AccountActionsContext.Provider value={
        <button className="secondary compact" aria-haspopup="dialog" aria-controls="account-dialog" onClick={() => {
            accountDialog.current?.showModal();
            void perform(async () => setCredentials(await api<Credential[]>('/api/credentials')));
        }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>
            </svg>{t('Account')}
        </button>
    }>
        <div className="noPrint">
        <dialog id="account-dialog" ref={accountDialog} className="sheet" aria-labelledby="account-title"
            onClose={() => setToken('')}
            onClick={event => {
                if (event.target !== event.currentTarget) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                if (event.clientX < bounds.left || event.clientX > bounds.right ||
                    event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
            }}>
            <div className="sheet-content">
            <div className="sheet-header">
                <h2 id="account-title">{t('Account')}</h2>
                <button className="secondary compact" autoFocus onClick={() => accountDialog.current?.close()}>{t('Close')}</button>
            </div>
            <section className="settings-section">
                <p className={styles.accountEmail}>{user.email}</p>
                <button className="secondary compact" disabled={busy} onClick={() => {
                    if (window.confirm(t('Sign out and discard unsaved changes?'))) void perform(async () => {
                        await api('/auth/logout', {}); accountDialog.current?.close(); setToken(''); setUser(null);
                    });
                }}>{t('Sign out')}</button>
            </section>
            <details className="settings-section settings-disclosure">
            <summary><h3>{t('MCP access tokens')}</h3></summary>
            <p className="settings-description">{t('Tokens expire after 90 days and allow reading and editing your account data.')}</p>
            <form className="vstack" onSubmit={event => { event.preventDefault(); void perform(async () => {
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
            </details>
            {error && <p role="alert">{error}</p>}
            </div>
        </dialog>
        </div>
        <div>{children}</div>
    </AccountActionsContext.Provider>;
}
