# @mutexa/mcp

A read-only [Model Context Protocol](https://modelcontextprotocol.io) server that lets Claude, Cursor or any MCP
client reason about liquidation exposure: Hyperliquid markets and positions, liquidation prices, slice and loan
ladders, Aave V3 reserves, linkability scores, tracker views and liquidation maps.

Everything runs locally on top of the open Mutexa packages and public venue data. No Mutexa API and no API key
are needed. Nothing is signed, no order is placed and no funds move.

## Install

Claude Code:

```sh
claude mcp add mutexa -- npx -y @mutexa/mcp
# with the Aave V3 tools
claude mcp add mutexa -e MUTEXA_ETH_RPC=https://your-ethereum-rpc -- npx -y @mutexa/mcp
```

Claude Desktop, Cursor and other clients (`mcpServers` config):

```json
{
  "mcpServers": {
    "mutexa": {
      "command": "npx",
      "args": ["-y", "@mutexa/mcp"],
      "env": { "MUTEXA_ETH_RPC": "https://your-ethereum-rpc" }
    }
  }
}
```

Streamable HTTP instead of stdio:

```sh
npx @mutexa/mcp --http --port 3000   # http://127.0.0.1:3000/mcp, stateless; GET /health
```

`MUTEXA_ETH_RPC` (or `--eth-rpc`, comma-separated for fallbacks) is only needed by `aave_reserves` and by
`plan_loans` with a reserve symbol. There is no built-in default endpoint; use one you trust.

## 30-second example

From [`examples/client.ts`](examples/client.ts), which starts the server over stdio like any MCP client would:

```ts
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
```

Then ask your agent things like "where would a 5x BTC long of $2M liquidate, and how would six slices spread
that out?", or "what do trackers see on 0x…, with my alert threshold at $250k?".

## Tools

Every tool is read-only and answers with one JSON text block:

```json
{ "data": { … }, "source": "Hyperliquid info API (metaAndAssetCtxs)", "fetchedAt": "2026-10-18T00:00:00.000Z" }
```

`source` names the public call or local computation behind the numbers. When an upstream fails or an input is
missing, the tool answers `isError` with `{ "error", "source" }` instead of a guess.

| Tool | Input | What it returns | Source |
|---|---|---|---|
| `hl_markets` | `coins?`, `limit?` | Perp markets: mark, 24h change and volume, open interest, hourly funding and APR, max leverage, size decimals, margin tiers | Hyperliquid `metaAndAssetCtxs` |
| `hl_positions` | `address` | Open positions with the venue's liquidation price next to the computed one | Hyperliquid `clearinghouseState`, `metaAndAssetCtxs` |
| `liq_price` | `kind: perp` (side, entry, size, margin, `coin` or `maxLeverage`) or `kind: loan` (collateral, debtUsd, price, liqThreshold) | Liquidation price and distance | `@mutexa/liq-math`, live tiers when `coin` is given |
| `plan_ladder` | coin, side, notional, leverage, placement, band, `slices` or `alertThreshold`, `sizeJitter?`, `seed?`, `entry?`, `feeRate?` + `accountCost?` | Slices, band, single-position comparison, alert sizing, cost preview when both cost inputs are given | `@mutexa/ladder` with live tiers and mark |
| `plan_loans` | `collateralSymbol` or `ltv` + `liqThreshold` + `priceUsd`, collateralAmount, debtUsd, loans, band, placement | Loans with staggered LTV, band, extra collateral, `overMax` | `@mutexa/ladder`, live Aave reserve when a symbol is given |
| `aave_reserves` | `symbols?` | Aave V3 Ethereum reserves at one block: LTV, liquidation threshold and bonus, flags, oracle price | On-chain reads through `MUTEXA_ETH_RPC` |
| `linkability_score` | slices, leverages, jitter, freshAccounts, privateFunding, alertThreshold | Score 0–100, level, factors with fixes | `@mutexa/linkability` |
| `tracker_view` | `address`, `threshold`, `replan?` | The tracker-view CLI's JSON: positions by closest liquidation, threshold flags, re-plans | Hyperliquid `clearinghouseState`, `allMids`, `metaAndAssetCtxs` |
| `liquidation_map` | `coin`, `rank`, `top` (at most 100), `range?`, `buckets?` | Liquidatable notional per price bucket with reconciling totals | Hyperliquid leaderboard file, `clearinghouseState`, `allMids` |

Inputs that only the user can know (alert threshold, fee rate, cost per account) are required inputs with no
defaults, and the server instructions tell the agent to ask for them.

## Library

| Export | What it does |
|---|---|
| `createServer(options?)` | An `McpServer` with every tool registered; connect it to any transport |
| `startStdio(options?)`, `startHttp({ host?, port?, path?, … })` | The two transports the CLI uses |
| `TOOLS`, `registerTools(server, ctx)`, `createContext(options)` | Tool definitions, for embedding them in another server |
| `SERVER_INSTRUCTIONS`, `VERSION`, `MAP_MAX_TOP` | Constants |

`options`: `fetch` (all HTTP reads), `ethRpcUrls`, `env`, and test hooks (`aave`, `leaderboard`, `now`).

## Tests

Every tool is called through an in-memory MCP client against recorded public responses (Hyperliquid markets,
one account under the fake address `0x…ee01`, the first leaderboard rows and their positions under fake
addresses `0x…e001`…, and one Aave V3 reserve snapshot), the tool list is pinned by a schema snapshot, and the
streamable HTTP transport is exercised on localhost. Fixtures are written by `ETH_RPC=… pnpm record <address>`;
the RPC URL and the real address are never written to disk. CI never touches the network.

Logs go to stderr only, so stdout stays protocol-clean on stdio.

## How Mutexa uses it

This is the agent-facing side of Mutexa: the same math and reads the app uses, exposed
so an agent can check a plan, a tracker view or a map and cite where every number came from. Agent trading
through slices comes later, through a separate, authenticated path; this server never gets that ability.

## Limitations

- **Read-only.** No orders, no signing, no funding.
- **Hyperliquid and Aave V3 Ethereum** only in this release.
- **The leaderboard file is unofficial.** `liquidation_map` depends on the file the Hyperliquid web app loads,
  which is not a documented API and can change.
- **Point in time.** Prices and positions change every second; always read `fetchedAt`.

Mutexa's privacy limits, for anything an agent plans with these tools: slices are hidden from public trackers,
not from the venues themselves; clustering by timing is still possible; very large positions still move markets;
splitting and privacy rails cost extra fees; fills that carry an integrator fee are marked as such. Follow each
venue's terms in your region.

## License

MIT © 2026 Mutexa
