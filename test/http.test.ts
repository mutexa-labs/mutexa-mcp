import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { describe, expect, it } from "vitest";
import { startHttp } from "../src/index";
import { aaveSnapshot, fakeFetch, leaderboard } from "./helpers/fixtures";

describe("streamable HTTP transport", () => {
  it("serves tools over HTTP on localhost, statelessly", async () => {
    const http = await startHttp({
      port: 0,
      fetch: fakeFetch(),
      leaderboard,
      aave: { snapshot: async () => aaveSnapshot },
    });
    const { port } = http.address() as AddressInfo;
    try {
      const health = await fetch(`http://127.0.0.1:${port}/health`);
      expect(await health.json()).toEqual({ ok: true });
      expect((await fetch(`http://127.0.0.1:${port}/mcp`)).status).toBe(405);
      expect((await fetch(`http://127.0.0.1:${port}/other`, { method: "POST" })).status).toBe(404);

      const client = new Client({ name: "test", version: "0.0.0" });
      await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(9);
      const r = await client.callTool({ name: "hl_markets", arguments: { limit: 2 } });
      expect(r.isError).toBeFalsy();
      await client.close();
    } finally {
      await new Promise((r) => http.close(r));
    }
  });
});
