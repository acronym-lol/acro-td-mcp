---
last_reviewed: 2026-08-27
---

# MCP Tools

Every tool registered by the Acro TD MCP server. Tool names are prefixed `td_*` to keep the TouchDesigner namespace obvious to MCP clients.

For request / response detail on the underlying HTTP layer, see the [HTTP API Reference](http-api).

---

## Connection & instances

### `td_health`

Confirm TouchDesigner is up. Returns:

```json
{ "status": "ok", "td_version": "099", "td_build": "2025.32280",
  "project": "AcroCore.toe", "osName": "Windows" }
```

Maps to `GET /`.

### `td_instances`

List every TD instance that has registered itself in `tempdir/acro-td-mcp-instances.json`. Useful when several TD projects are open and you want to confirm the MCP client is talking to the right one. Returns:

```json
{
  "cwd": "C:/Software/acro-td-core",
  "selected": { "port": 54200, "project_name": "acro-td-core" },
  "instances": [
    { "port": 54200, "project_name": "acro-td-core", "project_path": "…",
      "started": "…", "is_selected": true }
  ]
}
```

The MCP server auto-selects an instance by matching `process.cwd()` against each instance's `project_path`, then stays with that TD process (tracked by PID) even if its port changes. Pure client-side logic — no HTTP call. See [MCP Auto-Selection](http-api#mcp-auto-selection).

Each registry entry also holds the instance's access token, which the MCP server sends on every request. `td_instances` never includes it in its output.

---

## Code execution

### `td_execute`

Run Python in TD. Args:

| Arg | Required | Description |
|-----|----------|-------------|
| `code` | yes | Python source |
| `from_op` | no | Operator path used as `me` (default `/`) |

The webserver tries `eval(code)` first; on `SyntaxError` it falls back to `exec(code)` and returns whatever locals the exec produced. Stdout and stderr are captured.

Maps to `POST /api/exec`.

---

## Operator inspection

### `td_op`

Serialize a single operator with all params via `TDJSON.opToJSONOp`. Args: `path`, optional `extra` (attribute filter, default `*`). Maps to `GET /api/op`.

### `td_children`

List children of a path. Args: `path` (default `/`), `depth` (default `1`), `tags` (comma-separated tag filter — useful for `version_tracking` / `tox_managed` discovery). Maps to `GET /api/children`.

### `td_get_par`

Read a single parameter. Args: `path`, `name`. Returns value, default, type (style), label, page. Maps to `GET /api/par`.

### `td_set_par`

Write a single parameter. Args: `path`, `name`, `value` (string / number / boolean). Maps to `POST /api/par`.

---

## Visuals

### `td_top_preview`

Save a TOP to a temp PNG. Arg: `path`. Returns the file path + dimensions; use the client's `Read` tool to view. Maps to `GET /api/top`.

### `td_panel_preview`

Save a panel COMP's rendered output to a temp PNG via an internal OP Viewer TOP. Two-phase: the MCP client polls until the capture is ready. Arg: `path`. Maps to `POST /api/panel/start` → `GET /api/panel/result`.

### `td_panel_click`

Simulate a mouse click on a panel COMP at normalized (0–1) coordinates. Args: `path`, `u`, `v`, optional `clickCount` / `left` / `middle` / `right`. Maps to `POST /api/panel/click`.

---

## Network editor

### `td_pane`

Return the current network editor pane's owner path, view position, zoom, and pane name. Maps to `GET /api/editor/pane`.

### `td_selection`

Return the operators currently selected in the network editor. Maps to `GET /api/editor/selection`.

### `td_bounds`

Return the AABB bounds of an operator including its docked operators. Arg: `path`. Maps to `GET /api/bounds`.

### `td_layout`

List direct children of a path with their positions and sizes, sorted by `(x, y)`. Useful before creating new nodes — gives you a snapshot of the existing layout. Args: `path` (default `/`). Maps to `GET /api/layout`.

### `td_find_empty`

Find a clear position inside a component where a new node of size `w` × `h` can be placed without overlapping. Args: `path`, optional `w` / `h` / `margin`. Maps to `GET /api/find-empty`.

### `td_errors`

Return errors and warnings for a path. Args: `path` (default `/`), `recurse` (default `true`). Maps to `GET /api/errors`.

---

## Reference / documentation

### `td_guide`

Read curated TD workflow guides shipped in `reference/`. With no arg, returns the main guide (`guide.md`). With `topic`, returns one of `operators`, `rendering`, `glsl`, `patterns`, `pops`, `networking`, `audio`. Pure client-side file read — no HTTP call.

### `td_help`

Look up TouchDesigner's official documentation. Arg: `query` (operator name, Python class, or topic). Reads TouchDesigner's bundled offline help by default; falls back to `docs.derivative.ca` for newer content (POPs, etc.) or when offline help isn't available. Pure client-side fetch — no TD round-trip.

---

## Adding a new tool

1. Add the endpoint to `scripts/AcroMCP.py` — handler method + route entry in `self.routes`.
2. Add a typed client method in `src/client.ts`.
3. Register the MCP tool in `src/index.ts` with a Zod schema and a thin wrapper that calls `client.<method>`.
4. `npm run build`.

Pure documentation tools (like `td_guide`) skip steps 1 + 2 and only register on the Node side.
