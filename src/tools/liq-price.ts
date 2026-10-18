import { liqPrice, loanStats, tiersFor } from "@mutexa/liq-math";
import { z } from "zod";
import { ToolError } from "../context";
import { defineTool } from "./define";
import { coin, side, sideOf } from "./schemas";

export const liqPriceTool = defineTool({
  name: "liq_price",
  title: "Liquidation price",
  description:
    "Liquidation price of a fresh isolated Hyperliquid perp position (kind=perp: side, entry, size in coins, isolated margin in USD, and either coin to use that market's live margin tiers or maxLeverage for a single tier), or of a single-collateral, single-debt Aave V3 loan in standard mode (kind=loan: collateral amount, debt in USD, collateral price, liquidation threshold). Uses Hyperliquid's documented formula and Aave's health factor.",
  input: {
    kind: z.enum(["perp", "loan"]),
    side: side.optional(),
    entry: z.number().positive().optional().describe("perp: entry price"),
    size: z.number().positive().optional().describe("perp: size in coins"),
    margin: z.number().positive().optional().describe("perp: isolated margin in USD"),
    coin: coin.optional().describe("perp: market whose live margin tiers to use"),
    maxLeverage: z.number().positive().optional().describe("perp: max leverage for a single tier, instead of coin"),
    collateral: z.number().positive().optional().describe("loan: collateral amount in tokens"),
    debtUsd: z.number().positive().optional().describe("loan: debt in USD"),
    price: z.number().positive().optional().describe("loan: collateral price in USD"),
    liqThreshold: z.number().gt(0).lt(1).optional().describe("loan: liquidation threshold, 0..1"),
  },
  openWorld: true,
  async run(a, ctx) {
    if (a.kind === "loan") {
      if (
        a.collateral === undefined ||
        a.debtUsd === undefined ||
        a.price === undefined ||
        a.liqThreshold === undefined
      )
        throw new ToolError("kind=loan needs collateral, debtUsd, price and liqThreshold");
      const l = loanStats(a.collateral, a.debtUsd, a.price, a.liqThreshold);
      return {
        data: { ...l, liquidationPrice: l.liq },
        source: "computed locally (@mutexa/liq-math, Aave V3 standard mode)",
      };
    }
    if (!a.side || a.entry === undefined || a.size === undefined || a.margin === undefined)
      throw new ToolError("kind=perp needs side, entry, size and margin");
    let tiers;
    let source = "computed locally (@mutexa/liq-math, Hyperliquid isolated margin)";
    if (a.coin) {
      const m = (await ctx.hl.perpMarkets()).find((x) => x.name === a.coin);
      if (!m) throw new ToolError(`Unknown Hyperliquid market ${a.coin}`);
      tiers = m.tiers;
      source += " with margin tiers from the Hyperliquid info API (metaAndAssetCtxs)";
    } else if (a.maxLeverage !== undefined) tiers = tiersFor(a.maxLeverage);
    else throw new ToolError("kind=perp needs coin (live margin tiers) or maxLeverage (single tier)");
    const s = sideOf(a.side);
    const liq = liqPrice(s, a.entry, a.size, a.margin, tiers);
    return {
      data: {
        liquidationPrice: liq,
        distance: Number.isFinite(liq) ? Math.abs(a.entry - liq) / a.entry : null,
        leverage: (a.size * a.entry) / a.margin,
        tiers: tiers.map((t) => ({ lowerBoundUsd: t.lowerBound, maxLeverage: t.maxLeverage })),
      },
      source,
    };
  },
});
