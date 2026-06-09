# Acro TD MCP

MCP server bridge for TouchDesigner — exposes a Python HTTP server in TD and a Node MCP server that wraps it as native tools for Claude Code.

## Architecture

- **Python side** (`scripts/AcroMCP.py`): `AcroMCP` extension class registers an HTTP webserver inside TD, exposes operator/parameter/network introspection and Python execution endpoints, and writes a registry of running instances to `tempdir/acro-td-mcp-instances.json`.
- **Node side** (`src/index.ts`): MCP server (registered as `acro-td-mcp`) wraps the HTTP API as MCP tools (`td_health`, `td_op`, `td_execute`, `td_top_preview`, `td_panel_preview`, `td_guide`, `td_help`, etc.). Auto-selects which TD instance to talk to based on current working directory.

## Build

```bash
npm install
npm run build
```

Produces `dist/index.js` which is what `.mcp.json` should point at.

## Environment

- `ACRO_TD_MCP` — set by `setup.ps1` / `setup.sh` to this module's root.
- `ACRO_TD_MCP_PORT` — optional override for which TD HTTP port the MCP client connects to. If unset, the client reads `acro-td-mcp-instances.json` and auto-selects.
- `TD_HELP_PATH` — optional override for where to find TouchDesigner's bundled help files (used by `td_help`).

## Installation

This module is typically installed as a git subtree in the acro-td-core template.

```bash
git subtree add --prefix=modules/acro-td-mcp https://github.com/acronym-lol/acro-td-mcp.git main --squash
```
