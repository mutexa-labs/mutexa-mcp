import { buildLiquidationMap, LEADERBOARD_URL } from "@mutexa/liquidation-map";
import { z } from "zod";
import { defineTool } from "./define";
import { coin } from "./schemas";

/** Largest sample the tool reads per call; each account is one public read. */
export const MAP_MAX_TOP = 100;

export const liquidationMap = defineTool({
  name: "liquidation_map",
  title: "Liquidation map of large accounts",
  description: `Where the largest Hyperliquid accounts get liquidated on one coin: ranks the leaderboard by 30-day volume or account value, reads the public positions of the top accounts (at most ${MAP_MAX_TOP}), and buckets their notional by liquidation price around the mark (longs below, shorts above). Totals reconcile: in range + outside + no liquidation price = total. The leaderboard is the file the Hyperliquid web app loads, not a documented API.`,
  input: {
    coin,
    rank: z.enum(["volume", "value"]).describe("Rank by 30-day volume or by account value"),
    top: z.number().int().min(1).max(MAP_MAX_TOP).describe("Accounts sampled from the top of the ranking"),
    range: z.number().gt(0).lt(1).optional().describe("Price range on each side of the mark (default 0.25)"),
    buckets: z.number().int().min(1).max(200).optional().describe("Price buckets across the range (default 60)"),
  },
  async run(a, ctx) {
    const m = await buildLiquidationMap({
      coin: a.coin,
      rank: a.rank,
      top: a.top,
      range: a.range ?? 0.25,
      buckets: a.buckets ?? 60,
      concurrency: 4,
      budget: 2 * a.top,
      fetch: ctx.fetch,
      client: ctx.hl.client,
      leaderboard: ctx.leaderboard,
      now: ctx.now,
    });
    return {
      data: {
        coin: m.coin,
        mark: m.mark,
        rank: m.rank,
        sampled: m.accounts.length,
        unread: m.failed.length,
        leaderboardRows: m.leaderboardRows,
        positions: m.positions.length,
        ...m.map,
      },
      source: `Hyperliquid leaderboard file (${LEADERBOARD_URL}) and info API (clearinghouseState, allMids)`,
    };
  },
});
