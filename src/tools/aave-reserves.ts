import { isBorrowable, isCollateral } from "@mutexa/venue-adapters/aave-v3";
import { z } from "zod";
import { defineTool } from "./define";

export const aaveReserves = defineTool({
  name: "aave_reserves",
  title: "Aave V3 Ethereum reserves",
  description:
    "Risk parameters of every Aave V3 Ethereum reserve at one block: max LTV, liquidation threshold, liquidation bonus, collateral and borrow flags, frozen and paused state, and the AaveOracle price. The data provider and oracle are resolved from the PoolAddressesProvider, and nothing is reported if it no longer points at the expected Pool. Needs MUTEXA_ETH_RPC.",
  input: { symbols: z.array(z.string().min(1).max(32)).max(100).optional().describe("Only these reserve symbols") },
  async run({ symbols }, ctx) {
    const s = await ctx.aave().snapshot();
    const reserves = (symbols?.length ? s.reserves.filter((r) => symbols.includes(r.symbol)) : s.reserves).map((r) => ({
      ...r,
      canBackLoan: isCollateral(r),
      canBorrow: isBorrowable(r),
    }));
    return {
      data: {
        market: s.market,
        block: s.block,
        blockTime: new Date(s.blockTime).toISOString(),
        pool: s.pool,
        dataProvider: s.dataProvider,
        oracle: s.oracle,
        reserves,
      },
      source: `Aave V3 Ethereum on-chain reads at block ${s.block} (PoolAddressesProvider, PoolDataProvider, AaveOracle)`,
    };
  },
});
