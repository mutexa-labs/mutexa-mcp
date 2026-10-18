// pnpm build && pnpm exec tsx examples/client.ts
// Starts the server over stdio, lists its tools and asks for the three largest Hyperliquid markets.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "example", version: "0.0.0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/cli.js"] }));

const { tools } = await client.listTools();
console.log(tools.map((t) => t.name).join(", "));

const r = await client.callTool({ name: "hl_markets", arguments: { limit: 3 } });
const { data, source, fetchedAt } = JSON.parse((r.content as { text: string }[])[0]!.text);
for (const m of data.markets) console.log(m.name, m.mark, `max ${m.maxLeverage}x`);
console.log(source, fetchedAt);

await client.close();
