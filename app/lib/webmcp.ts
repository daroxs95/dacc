export type SiteTool = {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations: {readOnlyHint: boolean; untrustedContentHint?: boolean};
    execute: (input: unknown) => Promise<unknown>;
};

export type ModelContext = {
    registerTool: (tool: SiteTool, options: {signal: AbortSignal}) => void | Promise<void>;
};

export function getModelContext(): ModelContext | undefined {
    if (typeof document === "undefined") return;
    const context = (document as Document & {modelContext?: ModelContext}).modelContext;
    return typeof context?.registerTool === "function" ? context : undefined;
}

// Serialize registration and cleanup, including React's development remounts.
let lifecycle = Promise.resolve();
export function registerSiteTools(context: ModelContext | undefined, tools: SiteTool[], onError: (error: unknown) => void) {
    if (!context) return () => {};
    let disposed = false;
    const controller = new AbortController();
    lifecycle = lifecycle.then(async () => {
        for (const tool of tools) {
            if (disposed) break;
            await context.registerTool(tool, {signal: controller.signal});
        }
    }).catch(error => { controller.abort(); onError(error); });
    return () => {
        disposed = true;
        controller.abort();
    };
}
