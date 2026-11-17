import type {InvoiceRecord} from "./database";
import {invoiceAmount} from "./money";

export type InvoiceSortColumn = "invoiceNumber" | "client" | "created" | "due" | "total" | "paid";
export type SortDirection = "ascending" | "descending";

export function sortInvoices(invoices: InvoiceRecord[], column: InvoiceSortColumn,
    direction: SortDirection, language: string): InvoiceRecord[] {
    const collator = new Intl.Collator(language, {numeric: true, sensitivity: "base"});
    const value = (invoice: InvoiceRecord): string | number => {
        switch (column) {
            case "client": return invoice.companyToBill.name.trim();
            case "total": return invoiceAmount(invoice.quantity, invoice.rate);
            case "paid": return Number(invoice.paid);
            default: return invoice[column].trim();
        }
    };
    return [...invoices].sort((a, b) => {
        const left = value(a), right = value(b);
        // Keep missing numbers, clients and dates at the end in either direction.
        if (left === "" || right === "") return left === right ? 0 : left === "" ? 1 : -1;
        const comparison = typeof left === "number" && typeof right === "number"
            ? left - right : collator.compare(String(left), String(right));
        return direction === "ascending" ? comparison : -comparison;
    });
}
