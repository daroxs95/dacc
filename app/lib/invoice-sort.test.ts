import {test} from "node:test";
import assert from "node:assert/strict";
import {blankCompany, type InvoiceRecord} from "./database";
import {sortInvoices, type InvoiceSortColumn} from "./invoice-sort";

function invoice(invoiceNumber: string, overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
    return {id: invoiceNumber, profileId: "profile", invoiceNumber, created: "", due: "",
        description: "", quantity: 1, rate: 1, paid: false, showLogo: false, language: "en",
        company: blankCompany(), companyToBill: blankCompany(), ...overrides};
}

test("invoice numbers sort naturally without mutating the input, with blanks last", () => {
    for (const prefix of ["", "INV-"]) {
        const records = [invoice(prefix + "2"), invoice(""), invoice(prefix + "100"), invoice(prefix + "10")];
        assert.deepEqual(sortInvoices(records, "invoiceNumber", "descending", "en").map(i => i.invoiceNumber),
            [prefix + "100", prefix + "10", prefix + "2", ""]);
        assert.deepEqual(sortInvoices(records, "invoiceNumber", "ascending", "en").map(i => i.invoiceNumber),
            [prefix + "2", prefix + "10", prefix + "100", ""]);
        assert.equal(records[0].invoiceNumber, prefix + "2");
    }
});

test("client, date, amount and payment columns sort by their underlying values", () => {
    const first = invoice("1", {companyToBill: {...blankCompany(), name: "Alpha"},
        created: "2025-12-31", due: "2026-01-01", quantity: 2, rate: 4, paid: false});
    const second = invoice("2", {companyToBill: {...blankCompany(), name: "beta"},
        created: "2026-01-01", due: "2026-02-01", quantity: 1, rate: 10, paid: true});
    for (const column of ["client", "created", "due", "total", "paid"] as InvoiceSortColumn[]) {
        assert.deepEqual(sortInvoices([second, first], column, "ascending", "en"), [first, second]);
        assert.deepEqual(sortInvoices([first, second], column, "descending", "es"), [second, first]);
    }
});
