export class UsageError extends Error {
  override name = "UsageError";
}

export type CliArgs = { http: boolean; port: number; host: string; ethRpc?: string[]; help: boolean; version: boolean };

export function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { http: false, port: 3000, host: "127.0.0.1", help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const eq = a.startsWith("--") ? a.indexOf("=") : -1;
    const flag = eq > 0 ? a.slice(0, eq) : a;
    const take = () => {
      const v = eq > 0 ? a.slice(eq + 1) : argv[++i];
      if (v === undefined || v.startsWith("--")) throw new UsageError(`${flag} needs a value`);
      return v;
    };
    switch (flag) {
      case "--http":
        out.http = true;
        break;
      case "--port": {
        const p = Number(take());
        if (!Number.isInteger(p) || p < 1 || p > 65535) throw new UsageError("--port must be 1–65535");
        out.port = p;
        break;
      }
      case "--host":
        out.host = take();
        break;
      case "--eth-rpc":
        out.ethRpc = take()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "-h":
      case "--help":
        out.help = true;
        break;
      case "-v":
      case "--version":
        out.version = true;
        break;
      default:
        throw new UsageError(`Unknown option: ${a}`);
    }
  }
  return out;
}
