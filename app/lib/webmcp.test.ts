import {test} from "node:test";
import assert from "node:assert/strict";
import {getModelContext, registerSiteTools, type ModelContext, type SiteTool} from "./webmcp";
const tool: SiteTool = {name: "test", description: "Read test", inputSchema: {}, annotations: {readOnlyHint: true}, execute: async () => ({})};
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const fail = (error: unknown) => assert.fail(String(error));

test("registration supports unavailable browsers, aborted mounts, cleanup and remount", async () => {
    assert.equal(getModelContext(), undefined);
    registerSiteTools(undefined, [tool], fail)();
    const active = new Set<string>();
    const context: ModelContext = {registerTool: (item, {signal}) => {
        assert.equal(active.has(item.name), false);
        active.add(item.name);
        signal.addEventListener("abort", () => active.delete(item.name));
    }};
    registerSiteTools(context, [tool], fail)();
    const dispose = registerSiteTools(context, [tool], fail);
    await tick();
    assert.deepEqual([...active], ["test"]);
    dispose();
    assert.equal(active.size, 0);
    const again = registerSiteTools(context, [tool], fail);
    await tick();
    assert.equal(active.size, 1);
    again();
});

test("partial registration failure removes previously registered tools", async () => {
    const active = new Set<string>();
    let failed = false;
    const context: ModelContext = {registerTool: (item, {signal}) => {
        if (item.name === "bad") throw new Error("registration failed");
        active.add(item.name);
        signal.addEventListener("abort", () => active.delete(item.name));
    }};
    registerSiteTools(context, [tool, {...tool, name: "bad"}], () => { failed = true; });
    await tick();
    assert.equal(failed, true);
    assert.equal(active.size, 0);
});
