import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createContext, type ServerOptions } from "./context";
import { registerTools } from "./tools/index";
import { VERSION } from "./version";

export const SERVER_INSTRUCTIONS = [
  "Mutexa tools for reasoning about liquidation exposure, built only on public data.",
  "Every answer is JSON { data, source, fetchedAt }: cite the source and time when you state a number.",
  "The server is read-only: it never signs, places orders or moves funds, and needs no API key.",
  "Alert thresholds, fee rates and account costs are the user's own inputs; ask for them instead of assuming values.",
].join(" ");

/** Builds the Mutexa MCP server with every tool registered. Connect it to any transport. */
export function createServer(opts: ServerOptions = {}): McpServer {
  const server = new McpServer(
    { name: "mutexa", title: "Mutexa", version: VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );
  registerTools(server, createContext(opts));
  return server;
}
