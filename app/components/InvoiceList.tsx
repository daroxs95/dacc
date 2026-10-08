import {useLang} from "~/hooks/useLang";
import {useState} from "react";
import type {InvoiceRecord} from "~/lib/database";
import {invoiceAmount} from "~/lib/money";
import {sortInvoices, type InvoiceSortColumn, type SortDirection} from "~/lib/invoice-sort";

export function InvoiceList({invoices, ready, busy, onOpen, onCreate}: {
    invoices: InvoiceRecord[];
    ready: boolean;
    busy: boolean;
    onOpen: (profile: InvoiceRecord) => void;
    onCreate: () => void;
}) {
    const {t, money, language} = useLang();
    const [sort, setSort] = useState<{column: InvoiceSortColumn; direction: SortDirection}>({
        column: "invoiceNumber", direction: "descending",
    });
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");
    const query = search.trim().toLocaleLowerCase();
    const filtered = invoices.filter(profile =>
        [profile.invoiceNumber, profile.companyToBill.name, profile.description]
            .some(value => value.toLocaleLowerCase().includes(query)) &&
        (status === "all" || profile.paid === (status === "paid"))
    );
    const sorted = sortInvoices(filtered, sort.column, sort.direction, language);
    const columns = [
        {key: "invoiceNumber", label: "Invoice"}, {key: "client", label: "Client"},
        {key: "created", label: "Created"}, {key: "due", label: "Due"},
        {key: "total", label: "Total"}, {key: "paid", label: "Status"},
    ] as const;

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
                                {columns.map(({key, label}) => <th key={key} scope="col"
                                    className={key === "total" ? "numeric" : undefined}
                                    aria-sort={sort.column === key ? sort.direction : undefined}>
                                    <button className="table-sort" onClick={() => setSort(current => ({
                                        column: key,
                                        direction: current.column === key && current.direction === "ascending"
                                            ? "descending" : "ascending",
                                    }))}>
                                        {t(label)} <span aria-hidden="true">{sort.column === key
                                            ? sort.direction === "ascending" ? "↑" : "↓" : "↕"}</span>
                                    </button>
                                </th>)}
                            </tr></thead>
                            <tbody>{sorted.map(profile => <tr key={profile.id}>
                                <td><button className="text-link neutral" disabled={busy}
                                    aria-label={t("Open invoice {number}", {number: profile.invoiceNumber || profile.id})}
                                    onClick={() => onOpen(profile)}>{profile.invoiceNumber || t("No number")}</button></td>
                                <td>{profile.companyToBill.name || t("No client")}</td>
                                <td>{profile.created || t("No date")}</td>
                                <td>{profile.due || t("No date")}</td>
                                <td className="numeric">{money(invoiceAmount(profile.quantity, profile.rate))}</td>
                                <td><span className={`status-badge ${profile.paid ? "paid" : "pending"}`}>
                                    {profile.paid ? t("Paid") : t("Unpaid")}
                                </span></td>
                            </tr>)}</tbody>
                        </table>
                    </div>}
            </>}
    </section>;
}
