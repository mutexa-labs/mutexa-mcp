# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow semver (`0.x`: minor bumps may
change the API).

## [0.1.1] - 2026-10-19

### Fixed

- `@mutexa/venue-adapters` and `@mutexa/liquidation-map` move to v0.1.1 and `@mutexa/tracker-view` to v0.1.2, whose
  declaration builds succeed when installed from git.

## [0.1.0] - 2026-10-18

### Added

- MCP server with nine read-only tools: `hl_markets`, `hl_positions`, `liq_price`, `plan_ladder`, `plan_loans`,
  `aave_reserves`, `linkability_score`, `tracker_view`, `liquidation_map`. Every answer is
  `{ data, source, fetchedAt }`; failures are `{ error, source }`.
- stdio and stateless streamable HTTP transports; logging to stderr only.
- `mutexa-mcp` CLI with `--http`, `--port`, `--host` and `--eth-rpc` (or `MUTEXA_ETH_RPC`).
- Recorded fixtures with fake addresses, the recorder script, and a tool schema snapshot.
