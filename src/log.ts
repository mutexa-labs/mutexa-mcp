/**
 * Every log line goes to stderr. stdout belongs to the MCP stdio protocol, and a single stray write there
 * corrupts the JSON-RPC stream for the client.
 */
export function log(...parts: unknown[]): void {
  process.stderr.write(`[mutexa-mcp] ${parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" ")}\n`);
}
