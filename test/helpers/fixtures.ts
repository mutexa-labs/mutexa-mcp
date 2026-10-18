import { readFileSync } from "node:fs";
import { fixtureFetch, type HttpExchange } from "@mutexa/venue-adapters/conformance";
import type { AaveSnapshot } from "@mutexa/venue-adapters/aave-v3";

const read = (p: string) => readFileSync(new URL(`../../fixtures/${p}`, import.meta.url), "utf8");

export const hl = JSON.parse(read("hyperliquid.json")) as { account: string; exchanges: HttpExchange[] };
export const leaderboardText = read("leaderboard.json");
export const aaveSnapshot = JSON.parse(read("aave-snapshot.json")) as AaveSnapshot;

export const fakeFetch = () => fixtureFetch(hl.exchanges);

/** The recorded leaderboard as a stream cut into uneven chunks. */
export const leaderboard = async () => {
  const parts = leaderboardText.match(/[\s\S]{1,777}/g) ?? [];
  return new ReadableStream<string>({
    pull(c) {
      const p = parts.shift();
      if (p === undefined) c.close();
      else c.enqueue(p);
    },
  });
};
