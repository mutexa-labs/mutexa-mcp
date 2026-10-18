import { z } from "zod";

export const address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "a full 0x address (42 characters)")
  .describe("Public Hyperliquid account address (0x…, 42 characters)");
export const coin = z
  .string()
  .regex(/^[A-Za-z0-9:_-]{1,32}$/)
  .describe("Hyperliquid perp market name, for example BTC, ETH, kPEPE");
export const side = z.enum(["long", "short"]).describe("Position side");
export const usd = (what: string) => z.number().positive().finite().describe(what);
export const fraction = (what: string) => z.number().min(0).max(1).describe(what);

export const sideOf = (s: "long" | "short") => (s === "long" ? 1 : -1) as 1 | -1;
