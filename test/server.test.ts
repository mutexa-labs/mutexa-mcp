import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { liqPrice, tiersFor } from "@mutexa/liq-math";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, SERVER_INSTRUCTIONS, type ServerOptions } from "../src/index";
import { aaveSnapshot, fakeFetch, hl, leaderboard } from "./helpers/fixtures";

const NOW = Date.parse("2026-10-18T00:00:00Z");
let client: Client | null = null;

async function connect(opts: ServerOptions = {}) {
  const server = createServer({
    fetch: fakeFetch(),
    leaderboard,
    aave: { snapshot: async () => aaveSnapshot },
    env: {},
    now: () => NOW,
    ...opts,
  });
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

async function call(c: Client, name: string, args: Record<string, unknown> = {}) {
  const r = (await c.callTool({ name, arguments: args })) as CallToolResult;
  const text = r.content.map((p) => (p.type === "text" ? p.text : "")).join("");
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* validation errors from the SDK are plain text */
  }
  return { r, text, json };
}

afterEach(async () => {
  await client?.close();
  client = null;
});

describe("mutexa MCP server", () => {
  it("advertises nine read-only tools with instructions", async () => {
    const c = await connect();
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name)).toEqual([
      "hl_markets",
      "hl_positions",
      "liq_price",
      "plan_ladder",
      "plan_loans",
      "aave_reserves",
      "linkability_score",
      "tracker_view",
      "liquidation_map",
    ]);
    for (const t of tools) {
      expect(t.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
      expect(t.description!.length).toBeGreaterThan(80);
    }
    expect(c.getInstructions()).toBe(SERVER_INSTRUCTIONS);
    expect(c.getServerVersion()).toMatchObject({ name: "mutexa", version: "0.1.0" });
  });

  it("keeps the tool schemas stable", async () => {
    const c = await connect();
    const { tools } = await c.listTools();
    expect(tools).toMatchSnapshot();
  });

  it("answers every tool with { data, source, fetchedAt }", async () => {
    const c = await connect();
    const cases: [string, Record<string, unknown>][] = [
      ["hl_markets", { limit: 3 }],
      ["hl_positions", { address: hl.account }],
      ["liq_price", { kind: "perp", side: "long", entry: 100, size: 10, margin: 200, maxLeverage: 20 }],
      [
        "plan_ladder",
        { coin: "BTC", side: "long", notional: 1_000_000, leverage: 5, placement: "around", band: 0.5, slices: 6 },
      ],
      [
        "plan_loans",
        {
          ltv: 0.8,
          liqThreshold: 0.83,
          priceUsd: 2000,
          collateralAmount: 100,
          debtUsd: 100_000,
          loans: 4,
          band: 0.4,
          placement: "around",
        },
      ],
      ["aave_reserves", { symbols: ["WETH"] }],
      [
        "linkability_score",
        {
          slices: [100, 120, 90],
          leverages: [5, 4, 6],
          jitter: "light",
          freshAccounts: true,
          privateFunding: false,
          alertThreshold: 1000,
        },
      ],
      ["tracker_view", { address: hl.account, threshold: 250_000 }],
      ["liquidation_map", { coin: "BTC", rank: "volume", top: 10 }],
    ];
    for (const [name, args] of cases) {
      const { r, json, text } = await call(c, name, args);
      expect(r.isError, `${name}: ${text}`).toBeFalsy();
      expect(Object.keys(json).sort()).toEqual(["data", "fetchedAt", "source"]);
      expect(json.fetchedAt).toBe("2026-10-18T00:00:00.000Z");
      expect(typeof json.source).toBe("string");
    }
  });

  it("hl_markets filters by coin and reports unknown ones", async () => {
    const { json } = await call(await connect(), "hl_markets", { coins: ["ETH", "NOPE"] });
    expect(json.data.markets.map((m: { name: string }) => m.name)).toEqual(["ETH"]);
    expect(json.data.notFound).toEqual(["NOPE"]);
    expect(json.source).toBe("Hyperliquid info API (metaAndAssetCtxs)");
  });

  it("hl_positions shows venue and computed liquidation prices", async () => {
    const { json } = await call(await connect(), "hl_positions", { address: hl.account });
    const iso = json.data.positions.filter((p: { marginMode: string }) => p.marginMode === "isolated");
    expect(iso.length).toBeGreaterThan(0);
    for (const p of iso) expect(Math.abs(p.computedLiq - p.reportedLiq) / p.reportedLiq).toBeLessThan(1e-8);
  });

  it("liq_price matches liq-math for perps and loans", async () => {
    const c = await connect();
    const perp = await call(c, "liq_price", {
      kind: "perp",
      side: "short",
      entry: 100,
      size: 10,
      margin: 200,
      maxLeverage: 20,
    });
    expect(perp.json.data.liquidationPrice).toBe(liqPrice(-1, 100, 10, 200, tiersFor(20)));
    expect(perp.json.source).toBe("computed locally (@mutexa/liq-math, Hyperliquid isolated margin)");
    const live = await call(c, "liq_price", {
      kind: "perp",
      side: "long",
      entry: 100,
      size: 10,
      margin: 200,
      coin: "ETH",
    });
    expect(live.json.source).toMatch(/metaAndAssetCtxs/);
    const loan = await call(c, "liq_price", {
      kind: "loan",
      collateral: 10,
      debtUsd: 16_000,
      price: 2500,
      liqThreshold: 0.8,
    });
    expect(loan.json.data.liquidationPrice).toBeCloseTo(2000, 9);
    const bad = await call(c, "liq_price", { kind: "perp", side: "long", entry: 100, size: 10, margin: 200 });
    expect(bad.r.isError).toBe(true);
    expect(bad.json).toEqual({
      error: "kind=perp needs coin (live margin tiers) or maxLeverage (single tier)",
      source: "liq_price",
    });
  });

  it("plan_ladder sizes slices from the alert threshold and adds costs only when given", async () => {
    const c = await connect();
    const { json } = await call(c, "plan_ladder", {
      coin: "ETH",
      side: "short",
      notional: 1_000_000,
      leverage: 4,
      placement: "beyond",
      band: 0.5,
      alertThreshold: 200_000,
      sizeJitter: 0.3,
      seed: 7,
    });
    expect(json.data.alertSizing.slices).toBe(json.data.slices.length);
    expect(json.data.slicesAboveThreshold).toBe(0);
    expect(json.data).not.toHaveProperty("cost");
    expect(json.data).not.toHaveProperty("input");
    const withCost = await call(c, "plan_ladder", {
      coin: "ETH",
      side: "short",
      notional: 1_000_000,
      leverage: 4,
      placement: "beyond",
      band: 0.5,
      slices: 4,
      feeRate: 0.0004,
      accountCost: 2,
    });
    expect(withCost.json.data.cost.railFeesIncluded).toBe(false);
    const none = await call(c, "plan_ladder", {
      coin: "ETH",
      side: "short",
      notional: 1e6,
      leverage: 4,
      placement: "beyond",
      band: 0.5,
    });
    expect(none.json.error).toMatch(/Give slices, or alertThreshold/);
  });

  it("plan_loans reads the live reserve or takes the parameters offline", async () => {
    const c = await connect();
    const live = await call(c, "plan_loans", {
      collateralSymbol: "WETH",
      collateralAmount: 100,
      debtUsd: 50_000,
      loans: 3,
      band: 0.3,
      placement: "beyond",
    });
    const weth = aaveSnapshot.reserves.find((r) => r.symbol === "WETH")!;
    expect(live.json.data.collateral).toEqual({
      symbol: "WETH",
      ltv: weth.ltv,
      liqThreshold: weth.liqThreshold,
      priceUsd: weth.priceUsd,
    });
    expect(live.json.data.loans).toHaveLength(3);
    expect(live.json.source).toContain(`block ${aaveSnapshot.block}`);
    const bad = await call(c, "plan_loans", {
      collateralAmount: 1,
      debtUsd: 1,
      loans: 2,
      band: 0.3,
      placement: "around",
    });
    expect(bad.json.error).toMatch(/collateralSymbol, or ltv, liqThreshold and priceUsd/);
  });

  it("aave tools explain how to configure an RPC instead of guessing", async () => {
    const c = await connect({ aave: undefined, env: {} });
    const { r, json } = await call(c, "aave_reserves", {});
    expect(r.isError).toBe(true);
    expect(json.error).toMatch(/MUTEXA_ETH_RPC/);
  });

  it("linkability_score is the linkability spec's scorer", async () => {
    const { json } = await call(await connect(), "linkability_score", {
      slices: [500_000],
      leverages: [10],
      jitter: "off",
      freshAccounts: false,
      privateFunding: false,
      alertThreshold: 100_000,
    });
    expect(json.data.level).toBe("High");
    expect(json.source).toMatch(/^computed locally \(@mutexa\/linkability, spec /);
  });

  it("tracker_view returns the tracker-view CLI's JSON and needs a threshold", async () => {
    const c = await connect();
    const { json } = await call(c, "tracker_view", { address: hl.account, threshold: 250_000, replan: true });
    expect(json.data.summary.threshold).toBe(250_000);
    expect(json.data.replans).toHaveLength(json.data.positions.length);
    expect(json.source).toBe("Hyperliquid public info API (clearinghouseState, allMids, metaAndAssetCtxs)");
    const missing = await call(c, "tracker_view", { address: hl.account });
    expect(missing.r.isError).toBe(true);
  });

  it("liquidation_map reconciles and caps the sample", async () => {
    const c = await connect();
    const { json } = await call(c, "liquidation_map", { coin: "BTC", rank: "value", top: 20, range: 0.5, buckets: 10 });
    const d = json.data;
    expect(d.sampled).toBe(20);
    expect(d.inRange + d.outside + d.noLiq).toBeCloseTo(d.total, 6);
    expect(d.buckets).toHaveLength(10);
    expect(json.source).toMatch(/leaderboard file/);
    expect((await call(c, "liquidation_map", { coin: "BTC", rank: "volume", top: 101 })).r.isError).toBe(true);
    const tooMany = await call(c, "liquidation_map", { coin: "BTC", rank: "volume", top: 21 });
    expect(tooMany.json.error).toMatch(/format not recognised/);
  });

  it("rejects invalid input before any read", async () => {
    const f = fakeFetch();
    const c = await connect({ fetch: f });
    expect((await call(c, "hl_positions", { address: "0x123" })).r.isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
});
