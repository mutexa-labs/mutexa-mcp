// Records the test fixtures from live public sources.
//
//   ETH_RPC=<your endpoint> pnpm record <address>
//
// - fixtures/hyperliquid.json: metaAndAssetCtxs and allMids (trimmed), the given account's clearinghouseState
//   under a fake address (0x…ee01), and the clearinghouseState of the first leaderboard rows (trimmed to the fields
//   the map reads) under fake addresses.
// - fixtures/leaderboard.json: the first rows of Hyperliquid's leaderboard file in its own formatting, with fake
//   addresses and no display names.
// - fixtures/aave-snapshot.json: one Aave V3 Ethereum reserve snapshot.
// The RPC URL and the real addresses are never written to disk.

import { writeFileSync } from "node:fs";
import { HL_INFO_URL, type HlMetaAndCtxs } from "@mutexa/venue-adapters";
import { createAaveV3Adapter } from "@mutexa/venue-adapters/aave-v3";
import { LEADERBOARD_URL } from "@mutexa/liquidation-map";

const account = process.argv[2]?.toLowerCase();
const rpc = process.env.ETH_RPC;
if (!account || !rpc) {
  console.error("usage: ETH_RPC=<url> tsx scripts/record.ts <address>");
  process.exit(1);
}
const ROWS = 20;
const ACCOUNT = `0x${"ee01".padStart(40, "0")}`;
const rowFake = (i: number) => `0x${(0xe001 + i).toString(16).padStart(40, "0")}`;
const info = async (b: unknown) =>
  (await (
    await fetch(HL_INFO_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(b),
    })
  ).json()) as any;

// leaderboard rows
const text = await (await fetch(LEADERBOARD_URL)).text();
const starts: number[] = [];
const marker = /\n\s*\{\s*\n\s*"ethAddress"/g;
let m: RegExpExecArray | null;
while ((m = marker.exec(text)) && starts.length <= ROWS) starts.push(m.index);
let board = text.slice(0, starts[ROWS]!).replace(/,\s*$/, "") + "\n  ]\n}\n";
const rows = (JSON.parse(board) as { leaderboardRows: { ethAddress: string }[] }).leaderboardRows.map(
  (r) => r.ethAddress,
);

const exchanges: { request: unknown; response: unknown }[] = [];
const coins = new Set(["BTC", "ETH", "SOL", "HYPE"]);
const st = await info({ type: "clearinghouseState", user: account });
for (const p of st.assetPositions) coins.add(p.position.coin);
exchanges.push({ request: { type: "clearinghouseState", user: ACCOUNT }, response: st });
for (const [i, a] of rows.entries()) {
  const s = await info({ type: "clearinghouseState", user: a.toLowerCase() });
  const assetPositions = s.assetPositions.map(({ type, position: p }: any) => ({
    type,
    position: {
      coin: p.coin,
      szi: p.szi,
      leverage: { type: p.leverage.type, value: p.leverage.value },
      entryPx: p.entryPx,
      positionValue: p.positionValue,
      liquidationPx: p.liquidationPx,
    },
  }));
  exchanges.push({
    request: { type: "clearinghouseState", user: rowFake(i) },
    response: { assetPositions, time: s.time },
  });
}
const [meta, ctxs] = (await info({ type: "metaAndAssetCtxs" })) as HlMetaAndCtxs;
const keep = meta.universe.map((u, i) => (coins.has(u.name) ? i : -1)).filter((i) => i >= 0);
const universe = keep.map((i) => meta.universe[i]!);
const ids = new Set(universe.map((u) => u.marginTableId));
exchanges.push({
  request: { type: "metaAndAssetCtxs" },
  response: [
    { universe, marginTables: (meta.marginTables ?? []).filter(([id]) => ids.has(id)) },
    keep.map((i) => ctxs[i]),
  ],
});
const mids = await info({ type: "allMids" });
exchanges.push({
  request: { type: "allMids" },
  response: Object.fromEntries(Object.entries(mids).filter(([k]) => coins.has(k))),
});

const snap = await createAaveV3Adapter({ rpcUrls: [rpc] }).snapshot();

let hl = JSON.stringify(
  { recordedAt: new Date().toISOString(), recordedWith: "scripts/record.ts", account: ACCOUNT, exchanges },
  null,
  1,
);
hl = hl.split(account.slice(2)).join(ACCOUNT.slice(2));
board = board.replace(/"displayName":\s*"[^"]*"/g, '"displayName": null');
rows.forEach((a, i) => {
  board = board.split(a).join(rowFake(i));
  board = board.split(a.toLowerCase()).join(rowFake(i));
});
writeFileSync("fixtures/hyperliquid.json", hl + "\n");
writeFileSync("fixtures/leaderboard.json", board);
writeFileSync("fixtures/aave-snapshot.json", JSON.stringify(snap, null, 1) + "\n");
console.error(`wrote fixtures (${rows.length} leaderboard rows, ${universe.length} markets, Aave block ${snap.block})`);
