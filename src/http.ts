import { createServer as createHttpServer, type Server } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { ServerOptions } from "./context";
import { log } from "./log";
import { createServer } from "./server";

export type HttpOptions = ServerOptions & { host?: string; port?: number; path?: string };

/**
 * Streamable HTTP transport in stateless mode: every POST gets a fresh server and transport, so no session state
 * is kept between requests. Binds to 127.0.0.1 by default.
 */
export function startHttp(opts: HttpOptions = {}): Promise<Server> {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 3000;
  const path = opts.path ?? "/mcp";

  const http = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
      return;
    }
    if (url.pathname !== path) {
      res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "Not found" }));
      return;
    }
    if (req.method !== "POST") {
      res
        .writeHead(405, { "content-type": "application/json", allow: "POST" })
        .end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null }));
      return;
    }
    const server = createServer(opts);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (e) {
      log("http request failed:", e instanceof Error ? e.message : String(e));
      if (!res.headersSent)
        res
          .writeHead(500, { "content-type": "application/json" })
          .end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }));
    }
  });

  return new Promise((resolve, reject) => {
    http.once("error", reject);
    http.listen(port, host, () => {
      http.off("error", reject);
      resolve(http);
    });
  });
}
