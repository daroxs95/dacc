/** Collision-free content token. Callers should treat its representation as opaque. */
export function recordVersion(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(recordVersion).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, item]) => `${JSON.stringify(key)}:${recordVersion(item)}`).join(",")}}`;
    return JSON.stringify(value) ?? "null";
}

export class OperationError extends Error {
    constructor(public code: string, message: string) { super(message); }
}

export function checkVersion(current: unknown, expected: string | null | undefined) {
    if (expected !== undefined && (current ? recordVersion(current) : null) !== expected) {
        throw new OperationError("STALE_VERSION", "This record changed. Reopen it before saving.");
    }
}
