# Changelog

All notable changes to this project will be documented in this file.

## [1.2.1] - 2026-11-03
- Updated the MCP server's dependencies (MCP SDK 1.32, zod 4, esbuild 0.28), so npm audit is clean. The server now builds from the module's own lockfile, and the bundle ships with dist/THIRD_PARTY_LICENSES.txt, the licenses of the packages built into it.

## [1.2.0] - 2026-11-02
- Multiple TD instances work on Windows: a new instance no longer drops a running one's registry entry and takes its port (an entry counts as stale only once its process has exited, and ports something is already listening on are skipped). The MCP server stays with the TD it picked, tracked by PID: it follows it to a new port, picks the same project up again after a restart, and never talks to a different TD that takes the old port.

## [1.1.0] - 2026-10-29
- Requests need the per-session token from the instance registry and must come from this machine with no Origin; POST bodies must be JSON. Port choice skips OS-reserved ports, and a reload keeps the port and token.

## [1.0.5] - 2026-06-09
- Updated changelog and version paths 

## [1.0.3] - 2026-03-25
- Add on exit to clean up old instances in temp file
