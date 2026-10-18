import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ServerOptions } from "./context";
import { createServer } from "./server";

/** Serves MCP over stdin/stdout. Logs go to stderr only. */
export async function startStdio(opts: ServerOptions = {}): Promise<void> {
  await createServer(opts).connect(new StdioServerTransport());
}
