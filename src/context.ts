import { createHyperliquidAdapter, type FetchLike, type HyperliquidAdapter } from "@mutexa/venue-adapters";
import { createAaveV3Adapter, type AaveV3Adapter } from "@mutexa/venue-adapters/aave-v3";

export type ServerOptions = {
  /** `fetch` for every HTTP read (Hyperliquid info API and leaderboard). */
  fetch?: FetchLike;
  /** Ethereum RPC endpoints for the Aave V3 tools. Read from MUTEXA_ETH_RPC (comma-separated) when omitted. */
  ethRpcUrls?: string[];
  env?: Record<string, string | undefined>;
  /** Injected Aave reader (tests). */
  aave?: Pick<AaveV3Adapter, "snapshot">;
  /** Injected leaderboard stream (tests). */
  leaderboard?: () => Promise<ReadableStream<string>>;
  now?: () => number;
};

export type Ctx = {
  hl: HyperliquidAdapter;
  aave(): Pick<AaveV3Adapter, "snapshot">;
  fetch?: FetchLike;
  leaderboard?: () => Promise<ReadableStream<string>>;
  now(): number;
};

/** A failure whose message is safe and useful to show an agent as-is. */
export class ToolError extends Error {
  override name = "ToolError";
}

export function createContext(o: ServerOptions = {}): Ctx {
  const env = o.env ?? process.env;
  const rpcs =
    o.ethRpcUrls ??
    (env.MUTEXA_ETH_RPC ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  let aave: Pick<AaveV3Adapter, "snapshot"> | undefined = o.aave;
  return {
    hl: createHyperliquidAdapter({ fetch: o.fetch }),
    aave() {
      if (aave) return aave;
      if (!rpcs.length)
        throw new ToolError(
          "The Aave V3 tools need an Ethereum RPC endpoint: set MUTEXA_ETH_RPC (comma-separated for fallbacks) or pass --eth-rpc.",
        );
      aave = createAaveV3Adapter({ rpcUrls: rpcs });
      return aave;
    },
    fetch: o.fetch,
    leaderboard: o.leaderboard,
    now: o.now ?? Date.now,
  };
}
