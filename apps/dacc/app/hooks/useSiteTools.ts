import {useEffect, useRef} from "react";
import {getModelContext, registerSiteTools, type SiteTool} from "~/lib/webmcp";

export function useSiteTools(ready: boolean, tools: SiteTool[]) {
    const latest = useRef(tools);
    latest.current = tools;
    useEffect(() => {
        if (!ready) return;
        return registerSiteTools(getModelContext(), latest.current.map(tool => ({
            ...tool,
            execute: input => latest.current.find(current => current.name === tool.name)!.execute(input),
        })), error => console.error("DACC site tool registration failed", error));
    }, [ready]);
}
