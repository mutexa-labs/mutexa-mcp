import { planLoans } from "@mutexa/ladder";
import { z } from "zod";
import { ToolError } from "../context";
import { defineTool } from "./define";
import { fraction, usd } from "./schemas";

export const planLoansTool = defineTool({
  name: "plan_loans",
  title: "Plan a loan ladder",
  description:
    "Split one Aave V3 loan (one collateral, one debt, standard mode) into loans with staggered LTV so their liquidation prices form a band. Give collateralSymbol to use the live reserve (LTV, liquidation threshold, oracle price; needs MUTEXA_ETH_RPC), or ltv, liqThreshold and priceUsd to plan offline. Reports the band, extra collateral and whether the single loan is above max LTV.",
  input: {
    collateralSymbol: z
      .string()
      .min(1)
      .max(32)
      .optional()
      .describe("Aave V3 Ethereum reserve symbol, for example WETH"),
    ltv: z.number().gt(0).lt(1).optional().describe("Max LTV for new borrows, 0..1 (offline mode)"),
    liqThreshold: z.number().gt(0).lt(1).optional().describe("Liquidation threshold, 0..1 (offline mode)"),
    priceUsd: z.number().positive().optional().describe("Collateral price in USD (offline mode)"),
    collateralAmount: z.number().positive().describe("Collateral in tokens"),
    debtUsd: usd("Debt in USD"),
    loans: z.number().int().min(1).max(32).describe("Number of loans"),
    band: fraction("LTV stagger across loans, 0..1"),
    placement: z.enum(["around", "beyond"]),
    sizeJitter: fraction("Size variation across loans, 0..1 (default 0)").optional(),
    seed: z.number().int().optional().describe("Seed for the size variation (default 1)"),
  },
  async run(a, ctx) {
    let collateral: { symbol: string; ltv: number; liqThreshold: number; priceUsd: number };
    let source = "computed locally (@mutexa/ladder)";
    if (a.collateralSymbol) {
      const snap = await ctx.aave().snapshot();
      const r = snap.reserves.find((x) => x.symbol === a.collateralSymbol);
      if (!r) throw new ToolError(`Unknown Aave V3 reserve ${a.collateralSymbol}`);
      collateral = { symbol: r.symbol, ltv: r.ltv, liqThreshold: r.liqThreshold, priceUsd: r.priceUsd };
      source += ` with reserve data from Aave V3 Ethereum at block ${snap.block} (PoolDataProvider, AaveOracle)`;
    } else {
      if (a.ltv === undefined || a.liqThreshold === undefined || a.priceUsd === undefined)
        throw new ToolError("Give collateralSymbol, or ltv, liqThreshold and priceUsd");
      collateral = { symbol: "collateral", ltv: a.ltv, liqThreshold: a.liqThreshold, priceUsd: a.priceUsd };
    }
    const plan = planLoans({
      collateral,
      collateralAmount: a.collateralAmount,
      debtUsd: a.debtUsd,
      loans: a.loans,
      band: a.band,
      placement: a.placement,
      sizeJitter: a.sizeJitter ?? 0,
      seed: a.seed ?? 1,
    });
    return { data: { collateral, ...plan }, source };
  },
});
