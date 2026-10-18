import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import type { Ctx } from "../context";
import { aaveReserves } from "./aave-reserves";
import { register, type ToolDef } from "./define";
import { hlMarkets } from "./hl-markets";
import { hlPositions } from "./hl-positions";
import { linkabilityScore } from "./linkability";
import { liqPriceTool } from "./liq-price";
import { liquidationMap } from "./liquidation-map";
import { planLadder } from "./plan-ladder";
import { planLoansTool } from "./plan-loans";
import { trackerViewTool } from "./tracker-view";

export const TOOLS = [
  hlMarkets,
  hlPositions,
  liqPriceTool,
  planLadder,
  planLoansTool,
  aaveReserves,
  linkabilityScore,
  trackerViewTool,
  liquidationMap,
] as unknown as ToolDef<z.ZodRawShape>[];

export function registerTools(server: McpServer, ctx: Ctx): void {
  for (const t of TOOLS) register(server, ctx, t);
}
