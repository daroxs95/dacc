import {Invoice} from "~/components/Invoice/Invoice";
import styles from "./home.module.css";
import {useEffect, useRef, useState} from "react";
import {Link, useSearchParams} from "react-router";
import {ProfileActions} from "~/components/ProfileActions";
import {AccountActions} from "~/components/Account";
import {Expenses} from "~/components/Expenses";
import {RecordSources} from "~/components/RecordSources";
import {InvoiceList} from "~/components/InvoiceList";
import CompanyForm from "~/components/CompanyForm/CompanyForm";
import {useLang, type Lang} from "~/hooks/useLang";
import {useSiteTools} from "~/hooks/useSiteTools";
import {createRemoteTools} from "~/lib/remote-tools";
import {OperationError, recordVersion} from "~/lib/record-version";
import {errorKey, type MessageKey} from "~/lib/i18n";
import {blankCompany, createProfileBackup, loadDatabase, MAX_BACKUP_BYTES, parseBackup, readDatabase, restoreProfileBackup, saveProfile, saveInvoice, selectProfile, type Profile, type InvoiceRecord, type Database, type Currency, type ExpenseRecord, type RecordEvidence} from "~/lib/database";

function profileSignature(profile: InvoiceRecord) {
    return JSON.stringify([profile.profileId, profile.id, profile.invoiceNumber, profile.created, profile.due,
        profile.description, profile.quantity, profile.rate, profile.paid, profile.showLogo,
        profile.language, profile.company, profile.companyToBill, profile.currency ?? "USD", profile.paymentStatus, profile.notes, profile.sourceDocuments, profile.taxReporting]);
}

export default function Home() {
    const {t, language: interfaceLanguage, setLanguage: setInterfaceLanguage} = useLang();
    const [searchParams, setSearchParams] = useSearchParams();
    const expensesView = searchParams.get("view") === "expenses";
    const [expenseDirty, setExpenseDirty] = useState(false);
    const listView = searchParams.get("view") !== "editor";
    const setView = (list: boolean) => setSearchParams(previous => {
        const next = new URLSearchParams(previous);
        if (list) next.delete("view");
        else next.set("view", "editor");
        return next;
    });
    const configDialog = useRef<HTMLDialogElement>(null);
    const backupFileInput = useRef<HTMLInputElement>(null);
    const [configOpen, setConfigOpen] = useState(false);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<MessageKey | "">("");
    const [error, setError] = useState<MessageKey | "">("");
    const [pendingBackup, setPendingBackup] = useState<{text: string; data: Database; sourceId: string; targetId: string} | null>(null);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
    const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
    const [currency, setCurrency] = useState<Currency>("USD");
    const [invoiceEvidence, setInvoiceEvidence] = useState<RecordEvidence & {paymentStatus?: "unknown" | "confirmed"}>({});
    const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
    const [invoiceId, setInvoiceId] = useState("");
    const [editingInvoice, setEditingInvoice] = useState(false);
    const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
    const [profileName, setProfileName] = useState("");
    const [profileCompany, setProfileCompany] = useState<Company>(blankCompany);
    const [profileLanguage, setProfileLanguage] = useState<Lang>("es");
    const [profileShowLogo, setProfileShowLogo] = useState(true);
    const activeProfile = profiles.find(profile => profile.id === selectedProfile);
    const visibleInvoices = invoices.filter(invoice => invoice.profileId === selectedProfile);

    const [invoiceNumber, setInvoiceNumber] = useState("");
    const invoiceNumberInput = useRef<HTMLInputElement>(null);
    const [created, setCreated] = useState("");
    const [due, setDue] = useState("");
    const [description, setDescription] = useState("");
    const [quantity, setQuantity] = useState(0);
    const [rate, setRate] = useState(0);
    const [showLogo, setShowLogo] = useState(true);
    const [language, setLanguage] = useState<Lang>("es");

    const [company, setCompany] = useState<Company>(blankCompany);
    const [companyToBill, setCompanyToBill] = useState<Company>(blankCompany);

    const [paid, setPaid] = useState(false);
    const draft: InvoiceRecord = {id: invoiceId, profileId: selectedProfile ?? "", invoiceNumber, created, due, description,
        quantity, rate, paid, showLogo, language, company, companyToBill, currency, ...invoiceEvidence};
    const savedSignature = useRef(profileSignature(draft));
    const savedInvoiceVersion = useRef<string | null>(null);
    const invoiceDirty = profileSignature(draft) !== savedSignature.current;
    const invoiceReadOnly = !!invoiceId && !editingInvoice;
    const invoiceControlsDisabled = !ready || busy || !activeProfile;
    const savedProfile = useRef<Profile | null>(null);
    const mutationLock = useRef(false);

    const profileForm = {name: profileName, company: profileCompany, language: profileLanguage, showLogo: profileShowLogo};
    const baselineProfile = savedProfile.current;
    const profileDirty = configOpen && recordVersion(profileForm) !== recordVersion(baselineProfile ? {
        name: baselineProfile.name, company: baselineProfile.company, language: baselineProfile.language, showLogo: baselineProfile.showLogo,
    } : {name: "", company: blankCompany(), language: "es", showLogo: true});
    const workspace = useRef({ready, selectedProfile, invoiceId, draft, expenseDirty, profileDirty, configOpen, editingProfileId});
    workspace.current = {ready, selectedProfile, invoiceId, draft, expenseDirty, profileDirty, configOpen, editingProfileId};

    const reportError = (error: unknown) => {
        setError(errorKey(error));
    };

    const applyInvoice = (invoice: InvoiceRecord) => {
        savedSignature.current = profileSignature(invoice);
        savedInvoiceVersion.current = invoice.id ? recordVersion(invoice) : null;
        setInvoiceId(invoice.id);
        setCurrency(invoice.currency ?? "USD");
        setInvoiceEvidence({...("notes" in invoice ? {notes: invoice.notes} : {}), ...("sourceDocuments" in invoice ? {sourceDocuments: invoice.sourceDocuments} : {}),
            ...("taxReporting" in invoice ? {taxReporting: invoice.taxReporting} : {}), ...("paymentStatus" in invoice ? {paymentStatus: invoice.paymentStatus} : {})});
        setInvoiceNumber(invoice.invoiceNumber); setCreated(invoice.created); setDue(invoice.due);
        setDescription(invoice.description); setQuantity(invoice.quantity); setRate(invoice.rate);
        setPaid(invoice.paid); setShowLogo(invoice.showLogo); setLanguage(invoice.language);
        setCompany(invoice.company); setCompanyToBill(invoice.companyToBill);
    };

    const resetInvoice = (profile?: Profile) => applyInvoice({
        id: "", profileId: profile?.id ?? "", invoiceNumber: "", created: "", due: "", description: "",
        quantity: 0, rate: 0, paid: false, showLogo: profile?.showLogo ?? true,
        language: profile?.language ?? "es", company: profile?.company ?? blankCompany(), companyToBill: blankCompany(),
    });

    const applyDatabase = (data: Database) => {
        const active = data.profiles.find(profile => profile.id === data.activeProfileId) ?? data.profiles[0];
        setProfiles(data.profiles); setInvoices(data.invoices); setExpenses(data.expenses ?? []);
        setSelectedProfile(active?.id ?? null);
        resetInvoice(active);
    };

    const confirmDiscard = () => (!expenseDirty || window.confirm(t("Discard unsaved expense changes?"))) &&
        (profileSignature(draft) === savedSignature.current || window.confirm(t("Unsaved invoice changes will be discarded. Continue?")));

    const editProfile = (activeProfile?: Profile) => {
        savedProfile.current = activeProfile ?? null;
        setEditingProfileId(activeProfile?.id ?? null);
        setProfileName(activeProfile?.name ?? "");
        setProfileCompany(activeProfile?.company ?? blankCompany());
        setProfileLanguage(activeProfile?.language ?? "es");
        setProfileShowLogo(activeProfile?.showLogo ?? true);
    };

    const openSettings = () => {
        editProfile(activeProfile);
        configDialog.current?.showModal();
        setConfigOpen(true);
    };

    const save = async () => {
        if (!invoiceNumber.trim()) {
            invoiceNumberInput.current?.focus();
            throw new Error("Enter an invoice number.");
        }
        if (!selectedProfile) throw new Error("Select or create a profile before saving an invoice.");
        const invoice = {...draft, id: invoiceId || crypto.randomUUID()};
        await saveInvoice(invoice, selectedProfile, savedInvoiceVersion.current);
        savedSignature.current = profileSignature(invoice);
        savedInvoiceVersion.current = recordVersion(invoice);
        setInvoiceId(invoice.id);
        setInvoices((await readDatabase()).invoices);
    };

    const perform = async (action: () => Promise<void>) => {
        if (mutationLock.current) return;
        mutationLock.current = true;
        setBusy(true);
        setError("");
        setMessage("");
        try { await action(); }
        catch (error) { reportError(error); }
        finally { mutationLock.current = false; setBusy(false); }
    };

    useEffect(() => {
        let active = true;
        loadDatabase().then(data => {
            if (active) { applyDatabase(data); setReady(true); }
        }).catch(error => { if (active) reportError(error); });
        return () => { active = false; };
    }, []);

    useSiteTools(ready, createRemoteTools({
        context: () => {
            const current = workspace.current;
            return {ready: current.ready, activeProfileId: current.selectedProfile, selectedInvoiceId: current.invoiceId || null,
                invoiceDirty: profileSignature(current.draft) !== savedSignature.current,
                expenseDirty: current.expenseDirty, profileDirty: current.profileDirty, editingProfileId: current.editingProfileId, busy: mutationLock.current};
        },
        mutate: async action => {
            if (mutationLock.current) throw new OperationError("BUSY", "Another operation is in progress. Retry when it finishes.");
            mutationLock.current = true;
            const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            setBusy(true); setError(""); setMessage("");
            try {
                const result = await action();
                // Refresh saved data without resetting another invoice or a human draft.
                try {
                    const data = await readDatabase();
                    const current = workspace.current;
                    setProfiles(data.profiles); setInvoices(data.invoices); setExpenses(data.expenses ?? []);
                    if (!data.profiles.some(profile => profile.id === current.selectedProfile)) {
                        applyDatabase(data);
                        editProfile(data.profiles.find(profile => profile.id === data.activeProfileId) ?? data.profiles[0]);
                        setView(true);
                    } else if (current.invoiceId && profileSignature(current.draft) === savedSignature.current) {
                        const updated = data.invoices.find(invoice => invoice.id === current.invoiceId);
                        if (updated) applyInvoice(updated);
                    } else if (!current.invoiceId && profileSignature(current.draft) === savedSignature.current) {
                        const updated = data.profiles.find(profile => profile.id === current.selectedProfile);
                        if (updated) resetInvoice(updated);
                    }
                    if (current.configOpen && !current.profileDirty && current.editingProfileId) {
                        const updated = data.profiles.find(profile => profile.id === current.editingProfileId);
                        if (updated) {
                            savedProfile.current = updated;
                            setProfileName(updated.name); setProfileCompany(updated.company);
                            setProfileLanguage(updated.language); setProfileShowLogo(updated.showLogo);
                        }
                    }
                    setMessage("Changes saved by the agent.");
                } catch { setError("Changes were saved, but the view could not refresh. Reload DACC."); }
                return result;
            } finally {
                mutationLock.current = false; setBusy(false);
                requestAnimationFrame(() => {
                    if (focused?.isConnected && document.activeElement === document.body) focused.focus({preventScroll: true});
                });
            }
        },
    }));

    return (
        <div className={styles.app}>
            <main className={styles.main}>
                <nav className={`${styles.viewNav} noPrint workspace-nav`} aria-label={t("Workspace navigation")}>
                    <a className="workspace-brand" href="/" onClick={event => { event.preventDefault(); setView(true); }}>
                        <span className="workspace-monogram" aria-hidden="true">d.</span>DACC
                    </a>
                    {listView && <div className="tab-nav" role="group" aria-label={t("Records")}>
                        {([false, true] as const).map(isExpenses => {
                            const destination = new URLSearchParams(searchParams);
                            if (isExpenses) destination.set("view", "expenses");
                            else destination.delete("view");
                            const active = expensesView === isExpenses;
                            return <Link key={String(isExpenses)} to={{search: `?${destination}`}}
                                aria-current={active ? "page" : undefined}
                                onClick={event => {
                                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                                    if (active || !confirmDiscard()) {event.preventDefault(); return;}
                                    setExpenseDirty(false);
                                }}>
                                {t(isExpenses ? "Expenses" : "Invoices")}
                            </Link>;
                        })}
                    </div>}
                    <span className="workspace-profile" aria-label={t("Active profile")}>
                        {activeProfile?.name ?? t("No profile")}
                    </span>
                    <div className="workspace-nav-actions">
                        {!listView && <button disabled={busy} className="secondary compact" onClick={() => setView(true)}>
                            <span aria-hidden="true">←</span> {t("Back to invoices")}
                        </button>}
                        <button disabled={busy} className="secondary compact" aria-haspopup="dialog" onClick={openSettings}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                                <path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="white"/><circle cx="15" cy="17" r="3" fill="white"/>
                            </svg>{t("Settings")}
                        </button>
                        <AccountActions/>
                    </div>
                </nav>
                {!configOpen && <div className="noPrint">
                    {!ready && !error && <p role="status">{t("Opening local database…")}</p>}
                    {busy && <p role="status">{t("Working…")}</p>}
                    {message && <p role="status">{t(message)}</p>}
                    {error && <p role="alert">{t(error)}</p>}
                </div>}
                {expensesView && activeProfile && <Expenses key={activeProfile.id} profileId={activeProfile.id}
                    expenses={expenses.filter(item => item.profileId === activeProfile.id)} busy={busy} perform={perform}
                    onDirtyChange={setExpenseDirty} onSaved={async () => {setExpenses((await readDatabase()).expenses ?? []); setMessage("Expense saved.");}}/>}
                {listView && !expensesView && <InvoiceList key={selectedProfile} invoices={visibleInvoices} ready={ready} busy={busy || !activeProfile}
                    onCreate={() => {
                        if (!activeProfile || !confirmDiscard()) return;
                        resetInvoice(activeProfile);
                        setEditingInvoice(true);
                        setMessage(""); setError(""); setView(false);
                    }} onOpen={invoice => {
                        if (invoice.profileId !== selectedProfile || !confirmDiscard()) return;
                        applyInvoice(invoice);
                        setEditingInvoice(false);
                        setMessage(""); setError(""); setView(false);
                    }}/>}
                <div hidden={listView} className={styles.workspace}>
                    <section className="card surface noPrint" aria-labelledby="invoice-form-title">
                        <div className={styles.panelHeading}>
                            <span className={styles.step}>01</span>
                            <div><h2 id="invoice-form-title">{t("Invoice")}</h2><p>{t("Document details")}</p></div>
                        </div>
                        {invoiceReadOnly && <div className="toolbar hstack">
                            <button disabled={invoiceControlsDisabled} onClick={() => {
                                setEditingInvoice(true);
                                requestAnimationFrame(() => invoiceNumberInput.current?.focus());
                            }}>{t("Edit invoice")}</button>
                            <button className="secondary" disabled={invoiceControlsDisabled}
                                onClick={() => window.print()}>{t("Print invoice")}</button>
                        </div>}
                        <fieldset disabled={invoiceControlsDisabled || invoiceReadOnly} className={styles.editor}>
                            <label className="form-field">
                                {t("Invoice #")}
                                <input ref={invoiceNumberInput} required value={invoiceNumber} placeholder={t("E.g. 2026-001")} onChange={e => setInvoiceNumber(e.target.value)}/>
                            </label>
                            <div className={styles.fieldRow}>
                                <label className="form-field">
                                    {t("Created")}
                                    <input value={created} placeholder={t("DD/MM/YYYY")} onChange={e => setCreated(e.target.value)}/>
                                </label>
                                <label className="form-field">
                                    {t("Due")}
                                    <input value={due} placeholder={t("DD/MM/YYYY")} onChange={e => setDue(e.target.value)}/>
                                </label>
                            </div>
                            <hr className={styles.divider}/>
                            <label className="form-field">
                                {t("Description")}
                                <textarea rows={4} value={description} placeholder={t("Describe the service or product…")} onChange={e => setDescription(e.target.value)}/>
                            </label>
                            <div className={styles.fieldRow}>
                                <label className="form-field">
                                    {t("Amount")}
                                    <input type="number" step="any" value={quantity} onChange={e => setQuantity(Number(e.target.value))}/>
                                </label>
                                <label className="form-field">
                                    {t("Rate")}
                                    <input type="number" step="any" value={rate} onChange={e => setRate(Number(e.target.value))}/>
                                </label>
                            </div>
                            <hr className={styles.divider}/>
                            <label className={styles.checkField}>
                                <input type="checkbox" checked={showLogo} onChange={e => setShowLogo(e.target.checked)}/>
                                {t("Show logo")}
                            </label>
                            <label className="form-field">{t("Currency")}
                                <select value={currency} onChange={event => setCurrency(event.target.value as Currency)}>
                                    <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
                                </select>
                            </label>
                            <label className="form-field">{t("Payment status")}
                                <select value={invoiceEvidence.paymentStatus === "unknown" ? "unknown" : paid ? "paid" : "unpaid"}
                                    onChange={event => {setPaid(event.target.value === "paid"); setInvoiceEvidence({...invoiceEvidence, paymentStatus: event.target.value === "unknown" ? "unknown" : "confirmed"});}}>
                                    <option value="unknown">{t("Unknown")}</option><option value="paid">{t("Paid")}</option><option value="unpaid">{t("Unpaid")}</option>
                                </select>
                            </label>
                            <RecordSources record={invoiceEvidence}/>

                            <label className="form-field">{t("Invoice language")}
                                <select value={language} onChange={event => setLanguage(event.target.value as Lang)}>
                                    <option value="es">Español</option><option value="en">English</option>
                                </select>
                            </label>
                            <CompanyForm title={t("Issuing company")} company={company} setCompany={setCompany}/>
                            <CompanyForm title={t("Billing company")} company={companyToBill} setCompany={setCompanyToBill}/>
                            {!invoiceReadOnly && <div className={styles.actions}>
                                <button id="printButton" disabled={!invoiceDirty} onClick={() => void perform(async () => {
                                    await save();
                                    window.print();
                                })}>{t("Save and print")}</button>
                                <button className="secondary" disabled={!invoiceDirty} onClick={() => void perform(async () => {
                                    await save();
                                    setMessage("Invoice saved in the active profile.");
                                })}>{t("Save invoice")}</button>
                            </div>}
                        </fieldset>
                    </section>
                    <section className={styles.previewPanel} aria-label={t("Invoice preview")}>
                        <div className={styles.paper}>
            <Invoice
                invoiceNumber={invoiceNumber}
                created={created}
                due={due}
                items={[
                    {
                        description,
                        quantity,
                        rate
                    }
                ]}
                showLogo={showLogo}
                company={company}
                paid={paid && invoiceEvidence.paymentStatus !== "unknown"}
                currency={currency}
                companyToBill={companyToBill}
                language={language}
            />
                        </div>
                    </section>
                </div>
            </main>
            <div className="noPrint">
                <dialog ref={configDialog} className="sheet"
                    aria-labelledby="config-title"
                    onClick={event => {
                        if (event.target !== event.currentTarget) return;
                        const bounds = event.currentTarget.getBoundingClientRect();
                        if (event.clientX < bounds.left || event.clientX > bounds.right ||
                            event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
                    }}
                    onClose={() => {
                        setConfigOpen(false);
                        setPendingBackup(null);
                    }}>
                    <div className="sheet-content">
                    <div className="sheet-header">
                        <h2 id="config-title">{t("Settings")}</h2>
                        <button type="button" className="secondary compact" autoFocus onClick={() => configDialog.current?.close()}>
                            {t("Close")}
                        </button>
                    </div>
                    <div className="settings-section">
                        <label className="form-field">{t("Interface language")}
                            <select value={interfaceLanguage} onChange={event => setInterfaceLanguage(event.target.value as Lang)}>
                                <option value="en" lang="en">English</option>
                                <option value="es" lang="es">Español</option>
                            </select>
                        </label>
                    </div>
                    <div className="settings-section vstack">
                    <label className="form-field"><span>{t("Active profile")}</span>
                        <select aria-label={t("Active profile")} value={selectedProfile ?? ""} disabled={!ready || busy}
                            onChange={event => {
                                const id = event.target.value;
                                if (!confirmDiscard()) return;
                                void perform(async () => {
                                    await selectProfile(id);
                                    setSelectedProfile(id);
                                    const profile = profiles.find(profile => profile.id === id);
                                    savedProfile.current = profile ?? null;
                                    resetInvoice(profile);
                                    setEditingProfileId(profile?.id ?? null);
                                    setProfileName(profile?.name ?? "");
                                    setProfileCompany(profile?.company ?? blankCompany());
                                    setProfileLanguage(profile?.language ?? "es");
                                    setProfileShowLogo(profile?.showLogo ?? true);
                                    setView(true);
                                });
                            }}>
                            {!profiles.length && <option value="">{t("No profile")}</option>}
                            {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                        </select>
                    </label>
                    {configOpen && activeProfile && <ProfileActions key={activeProfile.id} profile={activeProfile}
                        count={profiles.length} disabled={!ready || busy} hasUnsavedEdits={profileDirty}
                        perform={perform} confirmDiscard={confirmDiscard} onChanged={async deleted => {
                            const data = await readDatabase();
                            setProfiles(data.profiles); setInvoices(data.invoices); setExpenses(data.expenses ?? []);
                            if (deleted) {
                                applyDatabase(data); setView(true); setPendingBackup(null);
                                editProfile(data.profiles.find(profile => profile.id === data.activeProfileId) ?? data.profiles[0]);
                                setMessage("Profile deleted.");
                            } else {
                                editProfile(data.profiles.find(profile => profile.id === selectedProfile));
                                setMessage("Profile saved.");
                            }
                        }}/>}
                    {error && <p role="alert">{t(error)}</p>}
                    {message && <p role="status">{t(message)}</p>}
                    </div>
                    <details className="settings-section settings-disclosure">
                        <summary><div><h3>{t("Profiles and companies")}</h3>
                            <p className="settings-description">{activeProfile?.name ?? t("No profile")}</p>
                        </div></summary>
                <fieldset disabled={!ready || busy} className={styles.sidebarFields}>
                    <p>{editingProfileId ? t("Edit profile") : t("New profile")}</p>
                    <label className="form-field">{t("Profile name")}
                        <input id="profile-name" value={profileName} onChange={event => setProfileName(event.target.value)}/>
                    </label>
                    <label className="form-field">{t("Default invoice language")}
                        <select value={profileLanguage} onChange={event => setProfileLanguage(event.target.value as Lang)}>
                            <option value="es">Español</option><option value="en">English</option>
                        </select>
                    </label>
                    <label className={styles.checkField}>
                        <input type="checkbox" checked={profileShowLogo} onChange={event => setProfileShowLogo(event.target.checked)}/>
                        {t("Show logo by default")}
                    </label>
                    <CompanyForm title={t("Profile company")} company={profileCompany} setCompany={setProfileCompany}/>
                    <button onClick={() => void perform(async () => {
                        if (!profileName.trim()) throw new Error("Enter a profile name.");
                        if (!editingProfileId && !confirmDiscard()) return;
                        const profile: Profile = {id: editingProfileId ?? crypto.randomUUID(), name: profileName.trim(),
                            company: profileCompany, language: profileLanguage, showLogo: profileShowLogo};
                        await saveProfile(profile, savedProfile.current ? recordVersion(savedProfile.current) : null);
                        savedProfile.current = profile;
                        const data = await readDatabase();
                        setProfiles(data.profiles);
                        if (!editingProfileId) {
                            await selectProfile(profile.id);
                            setSelectedProfile(profile.id); resetInvoice(profile); setView(true);
                        } else if (!invoiceId && profileSignature(draft) === savedSignature.current) resetInvoice(profile);
                        setEditingProfileId(profile.id);
                        setMessage("Profile saved.");
                    })}>{t("Save profile")}</button>
                    <button className="secondary" onClick={() => {
                        savedProfile.current = null;
                        setEditingProfileId(null); setProfileName(""); setProfileCompany(blankCompany());
                        setProfileLanguage("es"); setProfileShowLogo(true);
                    }}>{t("New profile")}</button>
                    {error && <p role="alert">{t(error)}</p>}
                </fieldset>
                    </details>
                    <section className="settings-section" aria-labelledby="backup-title">
                    <h3 id="backup-title">{t("Backups")}</h3>
                    <p className="settings-description">{t("Your data is saved to your account.")}</p>
                    <div className="settings-action">
                        <div><h4>{t("Download backup")}</h4><p className="settings-description">{t("The active profile and its saved invoices in one file.")}</p></div>
                        <button className="secondary compact" disabled={!ready || busy || !activeProfile} onClick={() => void perform(async () => {
                            const blob = new Blob([createProfileBackup(await readDatabase(), selectedProfile!)], {type: "application/json"});
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = `dacc-backup-${new Date().toISOString().slice(0, 10)}.json`;
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            setTimeout(() => URL.revokeObjectURL(url), 1000);
                            setMessage("Backup downloaded. Restore it into any profile.");
                        })}>{t("Download")}</button>
                    </div>
                    <div className="settings-action">
                        <div><h4>{t("Restore backup")}</h4><p className="settings-description">{t("Restore a backup into a profile you choose.")}</p></div>
                        <button type="button" className="secondary compact" disabled={!ready || busy || !activeProfile}
                            onClick={() => backupFileInput.current?.click()}>{t("Import")}</button>
                            <input ref={backupFileInput} hidden aria-label={t("Backup file")} type="file" accept=".json,application/json" disabled={busy}
                                onChange={event => {
                                    const file = event.currentTarget.files?.[0];
                                    event.currentTarget.value = "";
                                    if (!file) return;
                                    setPendingBackup(null);
                                    void perform(async () => {
                                        if (file.size > MAX_BACKUP_BYTES) throw new Error("Backup is too large (maximum 10 MB).");
                                        const text = await file.text();
                                        const backup = parseBackup(text);
                                        if (!backup.profiles.length) throw new Error("The backup has no profile to restore.");
                                        setPendingBackup({text, data: backup, sourceId: backup.profiles[0].id, targetId: selectedProfile ?? ""});
                                    });
                                }}/>
                    </div>
                    <p className="settings-note">{t("Keep a backup of your account data.")}</p>
                    {pendingBackup && <div className="vstack">
                        <label className="form-field">{t("Profile from backup")}
                            <select disabled={busy} value={pendingBackup.sourceId} onChange={event => setPendingBackup({...pendingBackup, sourceId: event.target.value})}>
                                {pendingBackup.data.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                            </select>
                        </label>
                        <label className="form-field">{t("Destination profile")}
                            <select disabled={busy} value={pendingBackup.targetId} onChange={event => setPendingBackup({...pendingBackup, targetId: event.target.value})}>
                                {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
                            </select>
                        </label>
                        <p>{t("Restore {invoices} invoices into {profile}? This replaces its invoices and company defaults, keeps its name, and discards unsaved edits. Other profiles are unchanged.", {invoices: pendingBackup.data.invoices.filter(invoice => invoice.profileId === pendingBackup.sourceId).length, profile: profiles.find(profile => profile.id === pendingBackup.targetId)?.name ?? ""})}</p>
                        <div className="hstack f-wrap">
                            <button disabled={busy} onClick={() => void perform(async () => {
                                await restoreProfileBackup(pendingBackup.text, pendingBackup.sourceId, pendingBackup.targetId);
                                setPendingBackup(null);
                                applyDatabase(await readDatabase());
                                setView(true);
                                setReady(true);
                                setMessage("Backup restored into the destination profile.");
                            })}>{t("Replace profile data")}</button>
                            <button disabled={busy} onClick={() => setPendingBackup(null)}>{t("Cancel")}</button>
                        </div>
                    </div>}
                    </section>
                    {!ready && !error && <p role="status">{t("Opening local database…")}</p>}
                    {busy && <p role="status">{t("Working…")}</p>}
                    {message && <p role="status">{t(message)}</p>}
                    {error && <p role="alert">{t(error)}</p>}
                    </div>
                </dialog>

            </div>
        </div>
    );
}
