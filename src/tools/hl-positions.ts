import { defineTool } from "./define";
import { address } from "./schemas";

export const hlPositions = defineTool({
  name: "hl_positions",
  title: "Hyperliquid positions of an address",
  description:
    "Open perp positions of any public Hyperliquid address: side, size, entry, mark, value, leverage, margin mode, margin and unrealized PnL, with the liquidation price Hyperliquid reports next to the one computed from the position's own state (isolated positions only; cross margin depends on the whole account, so computedLiq is null).",
  input: { address },
  async run({ address }, ctx) {
    const st = await ctx.hl.account(address);
    return { data: st, source: "Hyperliquid info API (clearinghouseState, metaAndAssetCtxs)" };
  },
});
