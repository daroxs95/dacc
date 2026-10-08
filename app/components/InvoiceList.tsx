import {useLang} from "~/hooks/useLang";
import {useState} from "react";
import type {InvoiceRecord} from "~/lib/database";

export function InvoiceList({invoices, ready, busy, onOpen, onCreate}: {
    invoices: InvoiceRecord[];
    ready: boolean;
    busy: boolean;
    onOpen: (profile: InvoiceRecord) => void;
    onCreate: () => void;
}) {
    const {t, money} = useLang();
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");
    const query = search.trim().toLocaleLowerCase();
    const filtered = invoices.filter(profile =>
        [profile.invoiceNumber, profile.companyToBill.name, profile.description]
            .some(value => value.toLocaleLowerCase().includes(query)) &&
        (status === "all" || profile.paid === (status === "paid"))
    );

    return <section className="card surface list-surface" aria-label={t("Saved invoices")}>
        <div className="filter-bar">
            <label className="form-field">
                {t("Search invoices")}
                <input type="search" value={search} placeholder={t("Number, client or description")}
                    onChange={event => setSearch(event.target.value)}/>
            </label>
            <label className="form-field">
                {t("Status")}
                <select value={status} onChange={event => setStatus(event.target.value)}>
                    <option value="all">{t("All")}</option>
                    <option value="paid">{t("Paid invoices")}</option>
                    <option value="unpaid">{t("Unpaid invoices")}</option>
                </select>
            </label>
            <button disabled={!ready || busy} onClick={onCreate}>{t("New invoice")}</button>
        </div>
        {!ready ? <p role="status">{t("Invoices will be available when the database opens.")}</p> :
            invoices.length === 0 ? <div className="vstack">
                <p>{t("No saved invoices.")}</p>
            </div> : <>
                <p className="card-subtitle" role="status">{t("{shown} of {total} invoices", {shown: filtered.length, total: invoices.length})}</p>
                {filtered.length === 0 ? <p>{t("No invoices match these filters.")}</p> :
                    <div className="table-scroll" tabIndex={0} role="region" aria-label={t("Invoice list")}>
                        <table className="data-table compact">
                            <thead><tr>
                                <th scope="col">{t("Invoice")}</th><th scope="col">{t("Client")}</th>
                                <th scope="col">{t("Created")}</th><th scope="col">{t("Due")}</th>
                                <th scope="col" className="numeric">{t("Total")}</th>
                                <th scope="col">{t("Status")}</th>
                            </tr></thead>
                            <tbody>{filtered.map(profile => <tr key={profile.id}>
                                <td><button className="text-link" disabled={busy}
                                    aria-label={t("Open invoice {number}", {number: profile.invoiceNumber || profile.id})}
                                    onClick={() => onOpen(profile)}>{profile.invoiceNumber || t("No number")}</button></td>
                                <td>{profile.companyToBill.name || t("No client")}</td>
                                <td>{profile.created || t("No date")}</td>
                                <td>{profile.due || t("No date")}</td>
                                <td className="numeric">{money(profile.quantity * profile.rate)}</td>
                                <td><span className={`status-badge ${profile.paid ? "paid" : "pending"}`}>
                                    {profile.paid ? t("Paid") : t("Unpaid")}
                                </span></td>
                            </tr>)}</tbody>
                        </table>
                    </div>}
            </>}
    </section>;
}
