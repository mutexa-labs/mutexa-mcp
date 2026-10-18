import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseArgs, UsageError, VERSION } from "../src/index";

describe("cli arguments", () => {
  it("parses transports and RPC endpoints", () => {
    expect(parseArgs([])).toEqual({ http: false, port: 3000, host: "127.0.0.1", help: false, version: false });
    expect(
      parseArgs(["--http", "--port=8080", "--host", "0.0.0.0", "--eth-rpc", "https://a.example, https://b.example"]),
    ).toMatchObject({
      http: true,
      port: 8080,
      host: "0.0.0.0",
      ethRpc: ["https://a.example", "https://b.example"],
    });
    expect(() => parseArgs(["--port", "0"])).toThrow(UsageError);
    expect(() => parseArgs(["--eth-rpc"])).toThrow(UsageError);
    expect(() => parseArgs(["--nope"])).toThrow(UsageError);
  });

  it("keeps the version in sync with package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(VERSION).toBe(pkg.version);
  });
});
