# AcroMCP

The AcroMCP (Acro TD Core MCP) is an HTTP API bridge that allows Claude (or any external tool) to introspect and manipulate the running TouchDesigner scene. It exposes a webserver with structured JSON endpoints for executing Python, inspecting operators, listing children, and getting/setting parameters.

## Overview

| Property | Value |
|----------|-------|
| **Extension** | `AcroMCP` |
| **Script** | `modules/acro-td-mcp/scripts/AcroMCP.py` |
| **Base class** | `CallbacksExt`, `AcroVersionExt` |
| **TD Location** | `/AcroCore/AcroMCP` |
| **Server Port** | `54200-54209` (auto-assigned) |
| **Response Format** | JSON |

## Multi-Instance Support

AcroMCP supports running multiple TouchDesigner instances simultaneously. Each instance automatically registers itself in a shared registry and is assigned a unique port.

### How It Works

1. **On startup**, AcroMCP reads the instance registry from the temp directory
2. **Finds an available port** in the range 54200-54209
3. **Registers itself** with project name, path, port, and PID
4. **On shutdown**, the instance is removed from the registry

### Instance Registry

The registry file is located at:
- **Windows**: `%TEMP%\acro-td-mcp-instances.json`
- **macOS**: `/tmp/acro-td-mcp-instances.json`

### MCP Auto-Selection

The MCP server automatically selects the correct TD instance based on:
1. **Working directory match** — If Claude Code runs from a project directory, it connects to the matching TD instance
2. **Fallback** — If no match, uses the first available instance

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
curl http://localhost:54200/
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
  -d '{"code": "str(op(\"/\").children)"}'

# Execute statements
curl -X POST http://localhost:54200/api/exec \
  -d '{"code": "x = len(op(\"/\").children)"}'

# Create an operator
curl -X POST http://localhost:54200/api/exec \
  -d '{"code": "op(\"/AcroCore\").create(textDAT, \"myText\")"}'
```

---

### `GET /api/op` — Inspect Operator

Serialize an operator's full details using `TDJSON.opToJSONOp()`.

**Query parameters:**

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `path` | Yes | — | Operator path (e.g., `/AcroCore/AcroMCP`) |
| `extra` | No | `*` | Extra attributes filter passed to `TDJSON.opToJSONOp()` |

**Response:**

```json
{
  "op": {
    "name": "AcroMCP",
    "path": "/AcroCore/AcroMCP",
    "type": "COMP",
    "family": "COMP",
    "params": { ... }
  }
}
```

**Example:**

```bash
curl "http://localhost:54200/api/op?path=/AcroCore/AcroMCP"
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
      "path": "/AcroCore/AcroMCP",
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
curl "http://localhost:54200/api/children?path=/"

# List with depth
curl "http://localhost:54200/api/children?path=/AcroCore&depth=2"

# Filter by tags
curl "http://localhost:54200/api/children?path=/&tags=version_tracking"
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
curl "http://localhost:54200/api/par?path=/AcroCore/AcroMCP&name=Webserverport"
```

---

### `POST /api/par` — Set Parameter

Set a parameter value on an operator.

**Request body:**

```json
{
  "path": "/AcroCore/AcroMCP",
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
  -d '{"path": "/AcroCore/AcroMCP", "name": "Webserverport", "value": 54200}'
```

## Error Handling

All endpoints return JSON error responses:

- **400** — Bad request (missing required parameters)
- **404** — Not found (operator or parameter doesn't exist, or unknown route)
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
| `/AcroCore/AcroMCP` | AcroMCP API bridge |
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
