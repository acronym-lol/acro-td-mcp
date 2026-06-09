# Acro TD MCP

MCP bridge for TouchDesigner — exposes scene introspection and Python execution to Claude Code (or any MCP-aware client).

## Architecture

```
Claude Code  →  MCP server (Node, dist/index.js)  →  AcroMCP HTTP API (localhost:54200-54209)  →  TouchDesigner
```

| Layer | Where | Role |
|-------|-------|------|
| **Python** | `scripts/AcroMCP.py` | TD extension. Webserver DAT + HTTP router. Registers each instance in `tempdir/acro-td-mcp-instances.json` |
| **Node** | `src/index.ts` → `dist/index.js` | MCP server. Wraps HTTP endpoints as MCP tools, auto-selects the right TD instance per project |
| **Reference docs** | `reference/*.md` | Served to clients via the `td_guide` tool |

Each TD instance grabs an unused port in 54200–54209 on init. The MCP server picks the matching instance based on the client's `cwd`.

## Quick start

In TD: `AcroMCP` lives at `/AcroMCP` (extension `ext.AcroMCP`, shortcut `op.AMCP`). It's wired automatically when the project loads — no setup needed in-scene.

Outside TD: build the Node bundle once after pulling fresh source:

```bash
cd modules/acro-td-mcp
npm install
npm run build
```

Then `.mcp.json` at the project root points Claude Code at `dist/index.js`.

## What it can do

The MCP server exposes ~15 tools, all prefixed `td_`:

| Tool | Purpose |
|------|---------|
| `td_health` | Confirm TD is running, return version info |
| `td_instances` | List all running TD instances + which one's currently selected |
| `td_execute` | Run Python in TD (eval then exec fallback) |
| `td_op` / `td_children` | Operator introspection |
| `td_get_par` / `td_set_par` | Read/write parameters |
| `td_top_preview` / `td_panel_preview` | Save TOP / Panel COMP to a PNG you can `Read` |
| `td_panel_click` | Simulate mouse click on a Panel COMP |
| `td_pane` / `td_selection` | Network editor state |
| `td_bounds` / `td_layout` / `td_find_empty` | Node positioning helpers |
| `td_errors` | Errors + warnings for an op (and descendants) |
| `td_guide` | Curated TouchDesigner reference docs (the `reference/` files) |
| `td_help` | Official TD docs lookup (offline help first, falls back to docs.derivative.ca) |

## Where to go next

- **[HTTP API Reference](http-api)** — Endpoints exposed by the AcroMCP webserver, request/response shapes, the multi-instance registry, error semantics.
- **[MCP Tools](mcp-tools)** — Tool-by-tool input schemas and what each maps to on the HTTP side.

## Environment

| Var | Default | Purpose |
|-----|---------|---------|
| `ACRO_TD_MCP` | (set by `setup.ps1`/`setup.sh`) | Module root on disk |
| `ACRO_TD_MCP_PORT` | unset | Force the MCP client to talk to a specific TD HTTP port instead of auto-selecting from the registry |
| `TD_HELP_PATH` | unset | Override where to find TouchDesigner's bundled offline help (consumed by `td_help`) |

## Installation

```bash
git subtree add --prefix=modules/acro-td-mcp https://github.com/acronym-lol/acro-td-mcp.git main --squash
```
