import { linkability, SPEC_VERSION } from "@mutexa/linkability";
import { z } from "zod";
import { defineTool } from "./define";
import { usd } from "./schemas";

export const linkabilityScore = defineTool({
  name: "linkability_score",
  title: "Linkability score",
  description:
    "How easily a set of slices could be clustered by an observer, 0 (hard to link) to 100 (easy), with every factor that added points and its suggested fix: slice count, size spread, leverage spread, timing jitter, fresh accounts, private funding and slices above your alert threshold. A heuristic documented in the linkability spec, not a statistical guarantee.",
  input: {
    slices: z.array(z.number().positive()).min(1).max(64).describe("Notional per slice in USD"),
    leverages: z.array(z.number().positive()).min(1).max(64).describe("Leverage per slice"),
    jitter: z.enum(["off", "light", "heavy"]).describe("Timing spread of the openings"),
    freshAccounts: z.boolean().describe("No account was used before this position"),
    privateFunding: z.boolean().describe("No slice was funded from a wallet visible to the others"),
    alertThreshold: usd("Your alert threshold in USD"),
  },
  openWorld: false,
  async run(a) {
    return { data: linkability(a), source: `computed locally (@mutexa/linkability, spec ${SPEC_VERSION})` };
  },
});
