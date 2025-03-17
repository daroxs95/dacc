const ES = {
    "Payment Method": "Método de Pago",
    "Bill to": "Facturar a",
    "Invoice": "Factura",
    "Created": "Creado",
    "Due": "Vencimiento",
    "Item & Description": "Artículo & Descripción",
    "Amount": "Cantidad",
    "Rate": "Tarifa",
    "Total": "Total",
    "Balance due": "Saldo adeudado",
    "Payment": "Pago",
}

export type Lang = "es" | "en";

export function useLang(lang: Lang) {
    function t(key: keyof typeof ES) {
        if (lang === "es" && key in ES) {
            return ES[key];
        }
        return key;
    }

    return {
        t
    }
}