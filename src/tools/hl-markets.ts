import { z } from "zod";
import { fundingApr } from "@mutexa/venue-adapters";
import { defineTool } from "./define";
import { coin } from "./schemas";

export const hlMarkets = defineTool({
  name: "hl_markets",
  title: "Hyperliquid perp markets",
  description:
    "Live Hyperliquid perp markets sorted by 24h volume: mark price, 24h change, volume, open interest, hourly funding and its annualised rate, max leverage, size decimals and margin tiers (notional bound and max leverage per tier). Filter by coins or take the top N.",
  input: {
    coins: z.array(coin).max(50).optional().describe("Only these markets"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(300)
      .optional()
      .describe("Most markets to return when no coins are given (default 20)"),
  },
  async run({ coins, limit }, ctx) {
    const all = await ctx.hl.perpMarkets();
    const picked = coins?.length ? all.filter((m) => coins.includes(m.name)) : all.slice(0, limit ?? 20);
    const missing = coins?.filter((c) => !all.some((m) => m.name === c)) ?? [];
    return {
      data: {
        markets: picked.map((m) => ({
          name: m.name,
          mark: m.mark,
          change24h: m.change,
          dayVolumeUsd: m.dayVolume,
          openInterestUsd: m.openInterestUsd,
          fundingHourly: m.fundingHourly,
          fundingApr: fundingApr(m.fundingHourly),
          maxLeverage: m.maxLeverage,
          onlyIsolated: m.onlyIsolated,
          szDecimals: m.szDecimals,
          tiers: m.tiers.map((t) => ({ lowerBoundUsd: t.lowerBound, maxLeverage: t.maxLeverage })),
        })),
        total: all.length,
        ...(missing.length ? { notFound: missing } : {}),
      },
      source: "Hyperliquid info API (metaAndAssetCtxs)",
    };
  },
});
