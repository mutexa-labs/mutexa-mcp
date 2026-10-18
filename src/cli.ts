#!/usr/bin/env node
import { parseArgs, UsageError } from "./args";
import { startHttp } from "./http";
import { log } from "./log";
import { startStdio } from "./stdio";
import { VERSION } from "./version";

const HELP = `mutexa-mcp ${VERSION}: read-only MCP server for liquidation exposure, built on public data

Usage:
  mutexa-mcp                        stdio transport (default; for Claude Desktop, Claude Code, Cursor)
  mutexa-mcp --http [--port 3000]   streamable HTTP on http://127.0.0.1:<port>/mcp
             [--host 127.0.0.1]

Options:
  --eth-rpc <url[,url]>  Ethereum RPC endpoints for the Aave V3 tools (env MUTEXA_ETH_RPC); no default
  -h, --help             show this help
  -v, --version          print the version

No API key is needed. Nothing is signed or sent except public reads.`;

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) process.stdout.write(HELP + "\n");
  else if (args.version) process.stdout.write(VERSION + "\n");
  else if (args.http) {
    await startHttp({ host: args.host, port: args.port, ethRpcUrls: args.ethRpc });
    log(`listening on http://${args.host}:${args.port}/mcp`);
  } else {
    await startStdio({ ethRpcUrls: args.ethRpc });
    log("ready on stdio");
  }
} catch (e) {
  if (e instanceof UsageError) {
    process.stderr.write(`${e.message}\n\n${HELP}\n`);
    process.exitCode = 2;
  } else {
    log("failed to start:", e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}
