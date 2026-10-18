import { alertSafeSlices, costPreview, planSlices } from "@mutexa/ladder";
import { z } from "zod";
import { ToolError } from "../context";
import { defineTool } from "./define";
import { coin, fraction, side, sideOf, usd } from "./schemas";

export const planLadder = defineTool({
  name: "plan_ladder",
  title: "Plan a liquidation ladder",
  description:
    "Split one Hyperliquid perp position into isolated slices whose liquidation prices form a band instead of one public line. Placement 'around' keeps the same capital as one position; 'beyond' puts no slice closer to price than the single position (more margin). Give slices, or alertThreshold to size every slice under your alert threshold. Optional cost preview when feeRate and accountCost are given. Uses the market's live margin tiers and mark.",
  input: {
    coin,
    side,
    notional: usd("Total position size in USD"),
    leverage: z.number().positive().describe("Target leverage of the whole position"),
    placement: z.enum(["around", "beyond"]),
    band: fraction("Leverage stagger across slices, 0..1"),
    slices: z.number().int().min(1).max(64).optional().describe("Number of slices"),
    alertThreshold: usd("Your alert threshold in USD; sets the slice count when slices is not given").optional(),
    sizeJitter: fraction("Size variation across slices, 0..1 (default 0: equal sizes)").optional(),
    seed: z.number().int().optional().describe("Seed for the size variation (default 1)"),
    entry: z.number().positive().optional().describe("Entry price (default: current mark)"),
    feeRate: z.number().min(0).max(0.01).optional().describe("Your venue fee rate per fill, for example 0.00045"),
    accountCost: z.number().min(0).optional().describe("Your cost per extra account in USD"),
  },
  async run(a, ctx) {
    const m = (await ctx.hl.perpMarkets()).find((x) => x.name === a.coin);
    if (!m) throw new ToolError(`Unknown Hyperliquid market ${a.coin}`);
    let n = a.slices;
    let sizing: ReturnType<typeof alertSafeSlices> | undefined;
    if (n === undefined) {
      if (a.alertThreshold === undefined)
        throw new ToolError("Give slices, or alertThreshold to size the slices from it");
      sizing = alertSafeSlices(a.notional, a.alertThreshold, { max: 64 });
      n = Math.min(64, sizing.slices);
    }
    const plan = planSlices({
      side: sideOf(a.side),
      entry: a.entry ?? m.mark,
      notional: a.notional,
      leverage: a.leverage,
      slices: n,
      band: a.band,
      placement: a.placement,
      sizeJitter: a.sizeJitter ?? 0,
      seed: a.seed ?? 1,
      tiers: m.tiers,
      szDecimals: m.szDecimals,
    });
    const { input: _input, ...rest } = plan;
    const cost =
      a.feeRate !== undefined && a.accountCost !== undefined
        ? costPreview({ notionals: plan.slices.map((s) => s.notional), feeRate: a.feeRate, accountCost: a.accountCost })
        : undefined;
    return {
      data: {
        coin: a.coin,
        entry: a.entry ?? m.mark,
        ...rest,
        ...(sizing ? { alertSizing: sizing } : {}),
        ...(a.alertThreshold !== undefined
          ? { slicesAboveThreshold: plan.slices.filter((s) => s.notional > a.alertThreshold!).length }
          : {}),
        ...(cost ? { cost } : {}),
      },
      source:
        "computed locally (@mutexa/ladder) with margin tiers and mark from the Hyperliquid info API (metaAndAssetCtxs)",
    };
  },
});
