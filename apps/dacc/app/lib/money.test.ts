import {test} from "node:test";
import assert from "node:assert/strict";
import {decimalAmount, invoiceCents} from "./money";

test("invoice cents round decimal halves symmetrically without floating-point multiplication", () => {
    assert.equal(invoiceCents(1, 1.005), 101n);
    assert.equal(invoiceCents(1, -1.005), -101n);
    assert.equal(invoiceCents(2.5, 99.95), 24988n);
    assert.equal(invoiceCents(0.1, 0.2), 2n);
    assert.equal(invoiceCents(1e-7, 1e7), 100n);
    assert.equal(invoiceCents(0, 1e308), 0n);
    assert.equal(decimalAmount(-1n), "-0.01");
    assert.equal(decimalAmount(0n), "0.00");
    assert.throws(() => invoiceCents(Infinity, 1));
});
