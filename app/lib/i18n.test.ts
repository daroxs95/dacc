import assert from "node:assert/strict";
import test from "node:test";
import {errorKey, formatMoney, messages, resolveLanguage, translate} from "./i18n";

test("saved preference wins; browser regions and unsupported languages fall back predictably", () => {
    assert.equal(resolveLanguage("en", ["es-ES"]), "en");
    assert.equal(resolveLanguage(null, ["fr-FR", "es-MX", "en"]), "es");
    assert.equal(resolveLanguage("invalid", ["EN-GB"]), "en");
    assert.equal(resolveLanguage(null, ["fr"]), "en");
});

test("every translation preserves interpolation placeholders", () => {
    for (const [key, value] of Object.entries(messages)) {
        assert.ok(value.trim());
        assert.deepEqual(value.match(/\{\w+\}/g)?.sort(), key.match(/\{\w+\}/g)?.sort(), key);
    }
    assert.equal(translate("es", "Open invoice {number}", {number: "$&-123"}), "Abrir factura $&-123");
    assert.equal(translate("en", "{shown} of {total} invoices", {shown: 0, total: 2}), "0 of 2 invoices");
});

test("known database errors localize and unknown browser errors use a safe fallback", () => {
    assert.equal(translate("es", errorKey(new Error("Invalid profile."))), "Perfil no válido.");
    assert.equal(errorKey(new SyntaxError("Unexpected token")), "The database operation failed.");
    assert.equal(errorKey(new Error("toString")), "The database operation failed.");
});

test("money uses the requested locale without changing currency", () => {
    for (const language of ["en", "es"] as const) {
        assert.equal(formatMoney(language, 1234.5), new Intl.NumberFormat(language, {
            style: "currency", currency: "USD",
        }).format(1234.5));
    }
    assert.notEqual(formatMoney("es", 12.5), formatMoney("en", 12.5));
});
