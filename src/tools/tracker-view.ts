import { trackerView } from "@mutexa/tracker-view";
import { z } from "zod";
import { defineTool } from "./define";
import { address, usd } from "./schemas";

export const trackerViewTool = defineTool({
  name: "tracker_view",
  title: "Tracker view of an address",
  description:
    "What public trackers see for any Hyperliquid address: every open position sorted by closest liquidation (side, size, value, leverage, isolated or cross, entry, mark, liquidation price, distance, uPnL), flags for positions above your alert threshold, and optionally a re-plan of each position into isolated slices placed beyond today's liquidation price. Same JSON as the tracker-view CLI.",
  input: {
    address,
    threshold: usd("Your alert threshold in USD: positions worth more are flagged. There is no default."),
    replan: z.boolean().optional().describe("Also re-plan each position into a band of slices"),
  },
  async run({ address, threshold, replan }, ctx) {
    const v = await trackerView({ address, threshold, replan: replan ?? false, adapter: ctx.hl, now: ctx.now });
    return { data: v.data, source: v.source };
  },
});
