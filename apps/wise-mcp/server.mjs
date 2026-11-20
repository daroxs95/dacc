import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { wiseGet } from "./wise.mjs";

const token = process.env.WISE_API_TOKEN?.trim();
const port = Number(process.env.PORT ?? 4317);
if (!token) throw new Error("Set WISE_API_TOKEN before starting the server.");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const scalar = z.union([z.string(), z.number(), z.boolean()]);
const server = createServer(async (request, response) => {
  if (request.headers.host !== `127.0.0.1:${port}` || request.headers.origin !== undefined) {
    response.writeHead(403).end();
    return;
  }
  if (request.url !== "/mcp") {
    response.writeHead(404).end();
    return;
  }
  if (request.method !== "POST") {
    response.writeHead(405, { Allow: "POST" }).end();
    return;
  }

  const mcp = new McpServer({ name: "wise", version: "1.0.0" });
  mcp.registerTool("wise_get", {
    description: "Forward a GET request to the Wise API using the configured token. Returns the HTTP status and response body.",
    inputSchema: {
      path: z.string().describe("Versioned Wise API path, e.g. /2026Q4/profiles"),
      query: z.record(z.union([scalar, z.array(scalar)])).optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, async ({ path, query }) => {
    try {
      return await wiseGet(token, path, query);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wise request failed.";
      return { isError: true, content: [{ type: "text", text: message.replaceAll(token, "[redacted]") }] };
    }
  });

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  response.once("close", () => { void mcp.close(); });
  try {
    await mcp.connect(transport);
    await transport.handleRequest(request, response);
  } catch {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Wise MCP listening at http://127.0.0.1:${port}/mcp`);
});
