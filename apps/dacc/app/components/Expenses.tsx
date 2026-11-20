import {useEffect, useState} from "react";
import {useLang} from "~/hooks/useLang";
import {useTablePagination} from "~/hooks/useTablePagination";
import {runTool, type Currency, type ExpenseRecord} from "~/lib/database";
import {recordVersion} from "~/lib/record-version";
import {invoiceAmount} from "~/lib/money";
import {RecordSources} from "./RecordSources";
import {TablePagination} from "./TablePagination";

const newExpense = (profileId: string): ExpenseRecord => ({id: "", profileId, supplier: "", reference: "", date: "",
    description: "", category: "", currency: "EUR", amount: 0, paymentStatus: "unknown"});
export function Expenses({profileId, expenses, busy, perform, onSaved, onDirtyChange}: {
    profileId: string; expenses: ExpenseRecord[]; busy: boolean;
    perform: (action: () => Promise<void>) => Promise<void>; onSaved: () => Promise<void>; onDirtyChange: (dirty: boolean) => void;
}) {
    const {t, money} = useLang();
    const [search, setSearch] = useState("");
    const [filterCurrency, setFilterCurrency] = useState("");
    const [draft, setDraft] = useState<ExpenseRecord | null>(null);
    const [baseline, setBaseline] = useState<ExpenseRecord | null>(null);
    const [requestId, setRequestId] = useState("");
    const dirty = !!draft && recordVersion(draft) !== recordVersion(baseline);
    useEffect(() => {onDirtyChange(dirty); return () => onDirtyChange(false);}, [dirty, onDirtyChange]);
    const discard = () => !dirty || window.confirm(t("Discard unsaved expense changes?"));
    const open = (expense: ExpenseRecord) => {
        if (!discard()) return;
        setDraft(expense); setBaseline(expense); setRequestId(crypto.randomUUID());
    };
    const rows = expenses.filter(item => (!filterCurrency || item.currency === filterCurrency) &&
        [item.supplier, item.reference, item.description, item.category].some(value => value.toLowerCase().includes(search.toLowerCase())))
        .sort((a,b) => b.date.localeCompare(a.date) || a.reference.localeCompare(b.reference));
    const pagination = useTablePagination(rows.length);
    return <section className="card surface list-surface noPrint" aria-label={t("Expenses")}>
        <div className="filter-bar">
            <label className="form-field">{t("Search expenses")}<input type="search" value={search}
                onChange={event => {setSearch(event.target.value); pagination.setPage(1);}}/></label>
            <label className="form-field">{t("Currency")}<select value={filterCurrency}
                onChange={event => {setFilterCurrency(event.target.value); pagination.setPage(1);}}>
                <option value="">{t("All")}</option><option>EUR</option><option>USD</option><option>GBP</option>
            </select></label>
            <button disabled={busy} onClick={() => open(newExpense(profileId))}>{t("New expense")}</button>
        </div>
        {draft && <form className="vstack" onSubmit={event => {
            event.preventDefault();
            void perform(async () => {
                const {id, profileId: _profileId, ...input} = draft;
                if (id) await runTool("update_expense", {profileId, expenseId: id, expectedVersion: recordVersion(baseline), expense: input});
                else await runTool("create_expense", {profileId, requestId, expense: input});
                await onSaved(); setDraft(null); setBaseline(null); onDirtyChange(false);
            });
        }}>
            <h3>{t(draft.id ? "Edit expense" : "New expense")}</h3>
            <fieldset className="vstack" disabled={busy}>
                <div className="toolbar">
                    <label className="form-field">{t("Supplier")}<input required value={draft.supplier} onChange={e => setDraft({...draft, supplier: e.target.value})}/></label>
                    <label className="form-field">{t("Reference")}<input required value={draft.reference} onChange={e => setDraft({...draft, reference: e.target.value})}/></label>
                    <label className="form-field">{t("Date")}<input type="date" required value={draft.date} onChange={e => setDraft({...draft, date: e.target.value})}/></label>
                </div>
                <label className="form-field">{t("Description")}<textarea value={draft.description} onChange={e => setDraft({...draft, description: e.target.value})}/></label>
                <div className="toolbar">
                    <label className="form-field">{t("Category")}<input value={draft.category} onChange={e => setDraft({...draft, category: e.target.value})}/></label>
                    <label className="form-field">{t("Currency")}<select value={draft.currency} onChange={e => setDraft({...draft, currency: e.target.value as Currency})}>
                        <option>EUR</option><option>USD</option><option>GBP</option>
                    </select></label>
                    <label className="form-field">{t("Total amount")}<input required type="number" step="0.01" value={draft.amount} onChange={e => setDraft({...draft, amount: Number(e.target.value)})}/></label>
                    <label className="form-field">{t("Payment status")}<select value={draft.paymentStatus} onChange={e => setDraft({...draft, paymentStatus: e.target.value as ExpenseRecord["paymentStatus"]})}>
                        <option value="unknown">{t("Unknown")}</option><option value="paid">{t("Paid")}</option><option value="unpaid">{t("Unpaid")}</option>
                    </select></label>
                </div>
                <div className="toolbar">
                    {([['netAmount','Net amount'], ['vatAmount','VAT amount'], ['withholdingAmount','Withholding amount']] as const).map(([key,label]) =>
                        <label key={key} className="form-field">{t(label)}<input type="number" step="0.01" value={draft[key] ?? ''} onChange={e => {
                            const next = {...draft}; if (e.target.value === '') delete next[key]; else next[key] = Number(e.target.value); setDraft(next);
                        }}/></label>)}
                </div>
                <RecordSources record={draft}/>
                <div className="toolbar"><button type="submit">{t("Save expense")}</button>
                    <button type="button" className="secondary" onClick={() => {if (discard()) {setDraft(null); setBaseline(null);}}}>{t("Cancel")}</button></div>
            </fieldset>
        </form>}
        <p className="card-subtitle" role="status">{t("{count} expenses", {count: rows.length})}</p>
        <div className="toolbar">{[...new Set(rows.map(item => item.currency))].map(currency =>
            <p key={currency}>{currency}: {money(rows.filter(item => item.currency === currency).reduce((sum,item) => sum + invoiceAmount(1,item.amount), 0), currency)}</p>)}</div>
        {rows.length > 0 && <div className="table-scroll" tabIndex={0} role="region" aria-label={t("Expenses")}>
            <table className="data-table compact"><thead><tr>
                {(["Reference", "Supplier", "Date", "Category", "Total", "Status"] as const).map(label => <th key={label} scope="col">{t(label)}</th>)}
            </tr></thead><tbody>{rows.slice(pagination.start, pagination.end).map(item => <tr key={item.id}>
                <td><button disabled={busy} className="text-link neutral" onClick={() => open(item)}>{item.reference}</button></td>
                <td>{item.supplier}</td><td>{item.date}</td><td>{item.category}</td><td className="numeric">{money(item.amount,item.currency)}</td>
                <td>{t(item.paymentStatus === "paid" ? "Paid" : item.paymentStatus === "unpaid" ? "Unpaid" : "Unknown")}</td>
            </tr>)}</tbody></table>
        </div>}
        <TablePagination pagination={pagination}/>
    </section>;
}
