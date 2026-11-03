---
last_reviewed: 2026-08-27
sidebar_label: 'HTTP API Reference'
---

# AcroMCP

The AcroMCP (Acro TD Core MCP) is an HTTP API bridge that allows Claude (or any external tool) to introspect and manipulate the running TouchDesigner scene. It exposes a webserver with structured JSON endpoints for executing Python, inspecting operators, listing children, and getting/setting parameters.

## Overview

| Property | Value |
|----------|-------|
| **Extension** | `AcroMCP` |
| **Script** | `modules/acro-td-mcp/scripts/AcroMCP.py` |
| **Base class** | `CallbacksExt`, `AcroVersionExt` |
| **TD Location** | `/AcroMCP` |
| **Server Port** | `54200-54209` (auto-assigned) |
| **Response Format** | JSON |

## Multi-Instance Support

AcroMCP supports running multiple TouchDesigner instances simultaneously. Each instance automatically registers itself in a shared registry and is assigned a unique port.

### How It Works

1. **On startup**, AcroMCP reads the instance registry from the temp directory
2. **Drops entries whose process has exited.** An entry for a running TD is always kept
3. **Finds an available port** in the range 54200-54209, skipping ports other instances have registered, ports Windows has reserved, and ports something else is already listening on
4. **Registers itself** with project name, path, port, PID and a fresh random token
5. **On extension reload** (for example after editing `AcroMCP.py`), it keeps its port and token
6. **On shutdown**, the instance is removed from the registry

### Instance Registry

The registry file is located at:
- **Windows**: `%TEMP%\acro-td-mcp-instances.json`
- **macOS**: `$TMPDIR/acro-td-mcp-instances.json`

The file holds each instance's token, so it's written readable by your user account only.

### MCP Auto-Selection

The MCP server automatically selects the correct TD instance based on:
1. **Working directory match** — If Claude Code runs from a project directory, it connects to the matching TD instance
2. **Fallback** — If no match, uses the first available instance

After that it stays with the instance it picked, tracked by PID. It looks the port and token up again on every request, so it follows that TD if it moves to another port, and never talks to a different TD that later takes the old port. If that TD restarts, the server picks up the same project again. If the project is closed, requests fail with an error rather than switching to another project; reconnect the MCP server to pick again.

### Listing Instances

Use the `td_instances` MCP tool to list all running TD instances:

```json
{
  "cwd": "C:/Software/acro-td-core",
  "selected": { "port": 54200, "project_name": "acro-td-core" },
  "instances": [
    {
      "port": 54200,
      "project_name": "acro-td-core",
      "project_path": "C:/Software/acro-td-core",
      "is_selected": true
    }
  ]
}
```

## Security

`POST /api/exec` runs any Python it's sent, so AcroMCP accepts a request only if all of these hold:

- **It carries the instance's token** as `Authorization: Bearer <token>`. This is the real protection.
- **It comes from this machine** and addresses `localhost`, `127.0.0.1` or `[::1]`. This is defense in depth: the
  Web Server DAT always listens on every network interface, and a request header named `clientAddress` can
  overwrite the address it reports.
- **It has no `Origin` header**, so web pages can't call it. The MCP server never sends one.
- **A POST body is `Content-Type: application/json`.**

The token is random, made fresh each time TouchDesigner starts, and only ever stored in the instance registry. It's
never saved into the `.toe`/`.tox`, and `td_instances` doesn't show it. The MCP server reads it from the registry on
every request, so a TouchDesigner restart needs no MCP restart.

### Getting the token for curl

Read the token for your port from the registry. These snippets keep it in a variable instead of printing it:

```powershell
# PowerShell
$TOKEN = ((Get-Content "$env:TEMP\acro-td-mcp-instances.json" | ConvertFrom-Json).instances |
          Where-Object port -eq 54200).token
curl.exe -H "Authorization: Bearer $TOKEN" http://localhost:54200/
```

```bash
# bash (macOS, or Git Bash on Windows)
TOKEN=$(node -e 'const r=require(require("os").tmpdir()+"/acro-td-mcp-instances.json");
  console.log(r.instances.find(i => i.port === 54200).token)')
curl -H "Authorization: Bearer $TOKEN" http://localhost:54200/
```

## API Endpoints

### `GET /` — Health Check

Returns basic info about the running TouchDesigner instance.

**Response:**

```json
{
  "status": "ok",
  "td_version": "099",
  "td_build": "2025.32280",
  "project": "acro-td-core",
  "osName": "Windows"
}
```

**Example:**

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:54200/
```

---

### `POST /api/exec` — Execute Python Code

Execute arbitrary Python code in the TouchDesigner environment. Tries `eval()` first (for expressions that return values), falls back to `exec()` on `SyntaxError` (for statements).

**Request body:**

```json
{
  "code": "str(op('/').children)"
}
```

**Response (eval success):**

```json
{
  "result": "...",
  "type": "str"
}
```

**Response (exec success):**

```json
{
  "result": {"varName": "value"},
  "type": "exec"
}
```

When using `exec()`, any local variables created by the code are returned in the result dict.

**Response (error):**

```json
{
  "error": "name 'foo' is not defined",
  "traceback": "..."
}
```

**Examples:**

```bash
# Evaluate an expression
curl -X POST http://localhost:54200/api/exec \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"code": "str(op(\"/\").children)"}'

# Execute statements
curl -X POST http://localhost:54200/api/exec \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"code": "x = len(op(\"/\").children)"}'

# Create an operator
curl -X POST http://localhost:54200/api/exec \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"code": "op(\"/AcroCore\").create(textDAT, \"myText\")"}'
```

---

### `GET /api/op` — Inspect Operator

Serialize an operator's full details using `TDJSON.opToJSONOp()`.

**Query parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `path` | Yes | — | Operator path (e.g., `/AcroMCP`) |
| `extra` | No | `*` | Extra attributes filter passed to `TDJSON.opToJSONOp()` |

**Response:**

```json
{
  "op": {
    "name": "AcroMCP",
    "path": "/AcroMCP",
    "type": "COMP",
    "family": "COMP",
    "params": { ... }
  }
}
```

**Example:**

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:54200/api/op?path=/AcroMCP"
```

---

### `GET /api/children` — List Children

List child operators of a given path, with optional depth and tag filtering.

**Query parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `path` | No | `/` | Parent operator path |
| `depth` | No | `1` | Maximum search depth |
| `tags` | No | — | Comma-separated tag filter |

**Response:**

```json
{
  "path": "/AcroCore",
  "children": [
    {
      "name": "AcroMCP",
      "path": "/AcroMCP",
      "type": "COMP",
      "family": "COMP"
    },
    ...
  ]
}
```

**Examples:**

```bash
# List root children
curl -H "Authorization: Bearer $TOKEN" "http://localhost:54200/api/children?path=/"

# List with depth
curl -H "Authorization: Bearer $TOKEN" "http://localhost:54200/api/children?path=/AcroCore&depth=2"

# Filter by tags
curl -H "Authorization: Bearer $TOKEN" "http://localhost:54200/api/children?path=/&tags=version_tracking"
```

---

### `GET /api/par` — Get Parameter

Read a single parameter's value and metadata.

**Query parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `path` | Yes | Operator path |
| `name` | Yes | Parameter name |

**Response:**

```json
{
  "name": "Webserverport",
  "value": 54200,
  "default": 54200,
  "type": "Int",
  "label": "Web Server Port",
  "page": "AcroMCP"
}
```

**Example:**

```bash
curl -H "Authorization: Bearer $TOKEN" "http://localhost:54200/api/par?path=/AcroMCP&name=Webserverport"
```

---

### `POST /api/par` — Set Parameter

Set a parameter value on an operator.

**Request body:**

```json
{
  "path": "/AcroMCP",
  "name": "Webserverport",
  "value": 54200
}
```

**Response:**

```json
{
  "ok": true,
  "name": "Webserverport",
  "value": 54200
}
```

**Example:**

```bash
curl -X POST http://localhost:54200/api/par \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"path": "/AcroMCP", "name": "Webserverport", "value": 54200}'
```

## Error Handling

All endpoints return JSON error responses:

- **400** — Bad request (missing required parameters)
- **401** — Missing or wrong token (see [Security](#security))
- **403** — Not a local request, a `Host` other than localhost, or an `Origin` header
- **404** — Not found (operator or parameter doesn't exist, or unknown route)
- **415** — A POST body that isn't `Content-Type: application/json`
- **500** — Internal server error (uncaught exception in handler)

Error response format:

```json
{
  "error": "Operator not found: /nonexistent",
  "traceback": "..."
}
```

## TD Scene Structure

Key operator paths in this project:

| Path | Description |
|------|-------------|
| `/` | Scene root |
| `/AcroCore` | Main project component |
| `/AcroMCP` | AcroMCP API bridge |
| `/AcroCore/AcroComponentCreator` | Component creation tool |
| `/AcroCore/AcroVersionManager` | Central version manager |

Use `GET /api/children?path=/` to discover the full scene structure.

## Implementation Details

- The webserver is a standard TouchDesigner **Web Server DAT**
- POST body arrives in `request['data']` as bytes (decoded to UTF-8 in `_parseBody()`)
- Query parameters are in `request['pars']` as a dict
- Routing is done via a `(method, path)` tuple lookup in `self.routes`
- `TDJSON.opToJSONOp()` and `TDJSON.serializeTDData()` are used for serialization
- The `/api/exec` endpoint has no sandboxing — it executes arbitrary Python in the TD environment
