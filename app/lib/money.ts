// Decimal arithmetic over existing numeric records. No binary floating-point multiplication.
function decimal(value: number): [bigint, number] {
    if (!Number.isFinite(value)) throw new Error("Invalid invoice amount.");
    const [mantissa, exponent = "0"] = String(value).toLowerCase().split("e");
    const fraction = mantissa.split(".")[1]?.length ?? 0;
    return [BigInt(mantissa.replace(".", "")), fraction - Number(exponent)];
}

/** USD minor units, rounding each invoice to cents, with halves away from zero. */
export function invoiceCents(quantity: number, rate: number): bigint {
    const [q, qs] = decimal(quantity);
    const [r, rs] = decimal(rate);
    const product = q * r;
    const scale = qs + rs - 2;
    if (scale <= 0) return product * 10n ** BigInt(-scale);
    const divisor = 10n ** BigInt(scale);
    const sign = product < 0n ? -1n : 1n;
    return sign * ((sign * product + divisor / 2n) / divisor);
}

export function decimalAmount(cents: bigint): string {
    const absolute = cents < 0n ? -cents : cents;
    return `${cents < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function invoiceAmount(quantity: number, rate: number): number {
    return Number(decimalAmount(invoiceCents(quantity, rate)));
}
