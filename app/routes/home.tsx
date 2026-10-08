import {Invoice} from "~/components/Invoice/Invoice";
import styles from "./home.module.css";
import {useEffect, useRef, useState} from "react";
import {useSearchParams} from "react-router";
import {InvoiceList} from "~/components/InvoiceList";
import CompanyForm from "~/components/CompanyForm/CompanyForm";
import {useLang, type Lang} from "~/hooks/useLang";
import {errorKey, type MessageKey} from "~/lib/i18n";
import {blankCompany, createBackup, loadDatabase, MAX_BACKUP_BYTES, parseBackup, readDatabase, restoreBackup, saveProfile, saveInvoice, selectProfile, type Profile, type InvoiceRecord, type Database} from "~/lib/database";

function profileSignature(profile: InvoiceRecord) {
    return JSON.stringify([profile.profileId, profile.id, profile.invoiceNumber, profile.created, profile.due,
        profile.description, profile.quantity, profile.rate, profile.paid, profile.showLogo,
        profile.language, profile.company, profile.companyToBill]);
}

export default function Home() {
    const {t, language: interfaceLanguage, setLanguage: setInterfaceLanguage} = useLang();
    const [searchParams, setSearchParams] = useSearchParams();
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
    const [pendingBackup, setPendingBackup] = useState<{text: string; count: number; invoiceCount: number} | null>(null);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
    const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
    const [invoiceId, setInvoiceId] = useState("");
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
        quantity, rate, paid, showLogo, language, company, companyToBill};
    const savedSignature = useRef(profileSignature(draft));

    const reportError = (error: unknown) => {
        setError(errorKey(error));
    };

    const applyInvoice = (invoice: InvoiceRecord) => {
        savedSignature.current = profileSignature(invoice);
        setInvoiceId(invoice.id);
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
        setProfiles(data.profiles); setInvoices(data.invoices);
        setSelectedProfile(active?.id ?? null);
        resetInvoice(active);
    };

    const confirmDiscard = () => profileSignature(draft) === savedSignature.current ||
        window.confirm(t("Unsaved invoice changes will be discarded. Continue?"));

    const openSettings = () => {
        setEditingProfileId(activeProfile?.id ?? null);
        setProfileName(activeProfile?.name ?? "");
        setProfileCompany(activeProfile?.company ?? blankCompany());
        setProfileLanguage(activeProfile?.language ?? "es");
        setProfileShowLogo(activeProfile?.showLogo ?? true);
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
        await saveInvoice(invoice, selectedProfile);
        savedSignature.current = profileSignature(invoice);
        setInvoiceId(invoice.id);
        setInvoices((await readDatabase()).invoices);
    };

    const perform = async (action: () => Promise<void>) => {
        setBusy(true);
        setError("");
        setMessage("");
        try { await action(); }
        catch (error) { reportError(error); }
        finally { setBusy(false); }
    };

    useEffect(() => {
        let active = true;
        loadDatabase().then(data => {
            if (active) { applyDatabase(data); setReady(true); }
        }).catch(error => { if (active) reportError(error); });
        return () => { active = false; };
    }, []);

    return (
        <div className={styles.app}>
            <main className={styles.main}>
                <nav className={`${styles.viewNav} noPrint workspace-nav`} aria-label={t("Workspace navigation")}>
                    <a className="workspace-brand" href="/" onClick={event => { event.preventDefault(); setView(true); }}>
                        <span className="workspace-monogram" aria-hidden="true">d.</span>DACC
                    </a>
                    <span className="workspace-profile" aria-label={t("Active profile")}>
                        {activeProfile?.name ?? t("No profile")}
                    </span>
                    <div className="workspace-nav-actions">
                        {!listView && <button className="secondary compact" onClick={() => setView(true)}>
                            <span aria-hidden="true">←</span> {t("Back to invoices")}
                        </button>}
                        <button className="secondary compact" aria-haspopup="dialog" onClick={openSettings}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                                <path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="white"/><circle cx="15" cy="17" r="3" fill="white"/>
                            </svg>{t("Settings")}
                        </button>
                    </div>
                </nav>
                {!configOpen && <div className="noPrint">
                    {!ready && !error && <p role="status">{t("Opening local database…")}</p>}
                    {busy && <p role="status">{t("Working…")}</p>}
                    {message && <p role="status">{t(message)}</p>}
                    {error && <p role="alert">{t(error)}</p>}
                </div>}
                {listView && <InvoiceList key={selectedProfile} invoices={visibleInvoices} ready={ready} busy={busy || !activeProfile}
                    onCreate={() => {
                        if (!activeProfile || !confirmDiscard()) return;
                        resetInvoice(activeProfile);
                        setMessage(""); setError(""); setView(false);
                    }} onOpen={invoice => {
                        if (invoice.profileId !== selectedProfile || !confirmDiscard()) return;
                        applyInvoice(invoice);
                        setMessage(""); setError(""); setView(false);
                    }}/>}
                <div hidden={listView} className={styles.workspace}>
                    <section className="card surface noPrint" aria-labelledby="invoice-form-title">
                        <div className={styles.panelHeading}>
                            <span className={styles.step}>01</span>
                            <div><h2 id="invoice-form-title">{t("Invoice")}</h2><p>{t("Document details")}</p></div>
                        </div>
                        <fieldset disabled={!ready || busy || !activeProfile} className={styles.editor}>
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
                            <label className={styles.checkField}>
                                <input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)}/>
                                {t("Paid invoice")}
                            </label>
                            <label className="form-field">{t("Invoice language")}
                                <select value={language} onChange={event => setLanguage(event.target.value as Lang)}>
                                    <option value="es">Español</option><option value="en">English</option>
                                </select>
                            </label>
                            <CompanyForm title={t("Issuing company")} company={company} setCompany={setCompany}/>
                            <CompanyForm title={t("Billing company")} company={companyToBill} setCompany={setCompanyToBill}/>
                            <div className={styles.actions}>
                                <button id="printButton" onClick={() => void perform(async () => {
                                    await save();
                                    window.print();
                                })}>{t("Save and print")}</button>
                                <button className="secondary" onClick={() => void perform(async () => {
                                    await save();
                                    setMessage("Invoice saved in the active profile.");
                                })}>{t("Save invoice")}</button>
                            </div>
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
                paid={paid}
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
                    <div className="settings-section">
                    <label className="form-field"><span>{t("Active profile")}</span>
                        <select aria-label={t("Active profile")} value={selectedProfile ?? ""} disabled={!ready || busy}
                            onChange={event => {
                                const id = event.target.value;
                                if (!confirmDiscard()) return;
                                void perform(async () => {
                                    await selectProfile(id);
                                    setSelectedProfile(id);
                                    const profile = profiles.find(profile => profile.id === id);
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
                        await saveProfile(profile);
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
                        setEditingProfileId(null); setProfileName(""); setProfileCompany(blankCompany());
                        setProfileLanguage("es"); setProfileShowLogo(true);
                    }}>{t("New profile")}</button>
                    {error && <p role="alert">{t(error)}</p>}
                </fieldset>
                    </details>
                    <section className="settings-section" aria-labelledby="backup-title">
                    <h3 id="backup-title">{t("Backups")}</h3>
                    <p className="settings-description">{t("Your data is stored in this browser.")}</p>
                    <div className="settings-action">
                        <div><h4>{t("Download backup")}</h4><p className="settings-description">{t("All your profiles and invoices in one file.")}</p></div>
                        <button className="secondary compact" disabled={!ready || busy} onClick={() => void perform(async () => {
                            const blob = new Blob([createBackup(await readDatabase())], {type: "application/json"});
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = `dacc-backup-${new Date().toISOString().slice(0, 10)}.json`;
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            setTimeout(() => URL.revokeObjectURL(url), 1000);
                            setMessage("Backup downloaded. Import it in DACC on your other device.");
                        })}>{t("Download")}</button>
                    </div>
                    <div className="settings-action">
                        <div><h4>{t("Restore backup")}</h4><p className="settings-description">{t("Import a DACC file from another device.")}</p></div>
                        <button type="button" className="secondary compact" disabled={busy}
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
                                        setPendingBackup({text, count: backup.profiles.length, invoiceCount: backup.invoices.length});
                                    });
                                }}/>
                    </div>
                    <p className="settings-note">{t("Save a backup before clearing browser data.")}</p>
                    {pendingBackup && <div className="vstack">
                        <p>{t("Import {profiles} profiles and {invoices} invoices? This replaces all saved profiles and invoices in this browser and discards unsaved edits. Download your current database first if you need to keep it.", {profiles: pendingBackup.count, invoices: pendingBackup.invoiceCount})}</p>
                        <div className="hstack f-wrap">
                            <button disabled={busy} onClick={() => void perform(async () => {
                                await restoreBackup(pendingBackup.text);
                                setPendingBackup(null);
                                applyDatabase(await readDatabase());
                                setView(true);
                                setReady(true);
                                setMessage("Database imported. Select a profile to continue.");
                            })}>{t("Replace database")}</button>
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
