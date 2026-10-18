import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import type { Ctx } from "../context";
import { log } from "../log";

export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/** What a tool's `run` returns; `fetchedAt` is added when it is sent. */
export type ToolOutput = { data: unknown; source: string };

export type ToolDef<S extends z.ZodRawShape> = {
  name: string;
  title: string;
  description: string;
  input: S;
  /** False for tools that compute locally without any network read. */
  openWorld?: boolean;
  run(args: z.infer<z.ZodObject<S>>, ctx: Ctx): Promise<ToolOutput>;
};

export function defineTool<S extends z.ZodRawShape>(t: ToolDef<S>): ToolDef<S> {
  return t;
}

/**
 * Every tool answers with one JSON text block, `{ data, source, fetchedAt }`, where `source` names the public
 * call (or local computation) used. Failures answer `isError` with `{ error, source }`, never a guess.
 */
export function register(server: McpServer, ctx: Ctx, t: ToolDef<z.ZodRawShape>): void {
  server.registerTool(
    t.name,
    {
      title: t.title,
      description: t.description,
      inputSchema: t.input,
      annotations: { ...READ_ONLY, openWorldHint: t.openWorld !== false },
    },
    async (args: Record<string, unknown>): Promise<CallToolResult> => {
      try {
        const r = await t.run(args as never, ctx);
        const body = { data: r.data, source: r.source, fetchedAt: new Date(ctx.now()).toISOString() };
        return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log(`${t.name} failed:`, message);
        return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: message, source: t.name }) }] };
      }
    },
  );
}
