/**
 * Acro TD Core MCP Server
 * Wraps AcroMCP HTTP API as native MCP tools for Claude Code.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AcroMCPClient, readRegistry, TDInstance } from "./client.js";
import { lookup as helpLookup, isAvailable as helpAvailable } from "./help.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REFERENCE_DIR = resolve(__dirname, "..", "reference");

const client = new AcroMCPClient();

const server = new McpServer({
  name: "acro-td-mcp",
  version: "0.1.0",
});

// ---------------------------------------------------------------------------
// td_health
// ---------------------------------------------------------------------------

server.registerTool(
  "td_health",
  {
    title: "Health Check",
    description:
      "Check if TouchDesigner is running and get basic info " +
      "(TD version, build, project name, OS).",
    inputSchema: {},
  },
  async () => {
    const result = await client.health();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_instances
// ---------------------------------------------------------------------------

server.registerTool(
  "td_instances",
  {
    title: "List TD Instances",
    description:
      "List all running TouchDesigner instances with their ports and project info. " +
      "Shows which instance is currently selected based on working directory.",
    inputSchema: {},
  },
  async () => {
    const instances = readRegistry();
    const selected = client.getSelectedInstance();
    const cwd = process.cwd();

    const result = {
      cwd,
      selected: selected
        ? { port: selected.port, project_name: selected.project_name }
        : null,
      instances: instances.map((inst: TDInstance) => ({
        port: inst.port,
        project_name: inst.project_name,
        project_path: inst.project_path,
        started: inst.started,
        is_selected: selected?.port === inst.port,
      })),
    };

    if (instances.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text:
              "No TouchDesigner instances registered.\n\n" +
              "Make sure TouchDesigner is running with AcroMCP active.\n" +
              JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_execute
// ---------------------------------------------------------------------------

server.registerTool(
  "td_execute",
  {
    title: "Execute Python",
    description:
      "Execute Python code in TouchDesigner's Python environment. " +
      "Has access to all TD modules (op, ui, etc.). " +
      "Uses eval() for expressions, falls back to exec() for statements. " +
      "Captures stdout and stderr. " +
      "Use 'me' to reference the context operator specified by from_op.",
    inputSchema: {
      code: z.string().describe("Python code to execute in TouchDesigner"),
      from_op: z
        .string()
        .optional()
        .describe("Context operator path for 'me' reference (default: '/')"),
    },
  },
  async ({ code, from_op }) => {
    const result = await client.execute(code, from_op);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_op
// ---------------------------------------------------------------------------

server.registerTool(
  "td_op",
  {
    title: "Inspect Operator",
    description:
      "Get detailed info about a TouchDesigner operator including all " +
      "parameters. Returns name, path, type, family, and full parameter data.",
    inputSchema: {
      path: z.string().describe("Operator path (e.g., '/AcroCore/AcroMCP')"),
      extra: z
        .string()
        .optional()
        .describe("Extra attributes filter (default: '*' for all)"),
    },
  },
  async ({ path, extra }) => {
    const result = await client.getOp(path, extra);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_children
// ---------------------------------------------------------------------------

server.registerTool(
  "td_children",
  {
    title: "List Children",
    description:
      "List child operators at the specified path. Supports depth " +
      "control and tag filtering for exploring the operator hierarchy.",
    inputSchema: {
      path: z
        .string()
        .optional()
        .describe("Parent operator path (default: '/')"),
      depth: z
        .number()
        .optional()
        .describe("Maximum search depth (default: 1)"),
      tags: z
        .string()
        .optional()
        .describe("Comma-separated tag filter (e.g., 'version_tracking')"),
    },
  },
  async ({ path, depth, tags }) => {
    const result = await client.getChildren(path, depth, tags);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_get_par
// ---------------------------------------------------------------------------

server.registerTool(
  "td_get_par",
  {
    title: "Get Parameter",
    description:
      "Read a single parameter's value and metadata from an operator. " +
      "Returns name, value, default, type (style), label, and page.",
    inputSchema: {
      path: z.string().describe("Operator path"),
      name: z.string().describe("Parameter name"),
    },
  },
  async ({ path, name }) => {
    const result = await client.getPar(path, name);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_set_par
// ---------------------------------------------------------------------------

server.registerTool(
  "td_set_par",
  {
    title: "Set Parameter",
    description:
      "Set a parameter value on an operator. Accepts string, number, " +
      "or boolean values.",
    inputSchema: {
      path: z.string().describe("Operator path"),
      name: z.string().describe("Parameter name"),
      value: z
        .union([z.string(), z.number(), z.boolean()])
        .describe("New parameter value"),
    },
  },
  async ({ path, name, value }) => {
    const result = await client.setPar(path, name, value);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_top_preview
// ---------------------------------------------------------------------------

server.registerTool(
  "td_top_preview",
  {
    title: "TOP Preview",
    description:
      "Save a TOP operator's current image to a temporary PNG file. " +
      "Returns the file path and metadata (dimensions, type). " +
      "Use the Read tool to view the saved image.",
    inputSchema: {
      path: z.string().describe("TOP operator path"),
    },
  },
  async ({ path }) => {
    const result = await client.getTopPreview(path);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_panel_preview
// ---------------------------------------------------------------------------

server.registerTool(
  "td_panel_preview",
  {
    title: "Panel Preview",
    description:
      "Save a Panel COMP's visual output to a temporary PNG file. " +
      "Uses an OP Viewer TOP to capture the panel contents. " +
      "Returns the file path and metadata (dimensions, type). " +
      "Use the Read tool to view the saved image.",
    inputSchema: {
      path: z.string().describe("COMP operator path"),
    },
  },
  async ({ path }) => {
    const result = await client.getPanelPreview(path);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_panel_click
// ---------------------------------------------------------------------------

server.registerTool(
  "td_panel_click",
  {
    title: "Panel Click",
    description:
      "Simulate a mouse click on a Panel COMP at normalized coordinates (0-1). " +
      "Use u=0, v=0 for bottom-left, u=1, v=1 for top-right. " +
      "Supports single/double/triple clicks and left/middle/right buttons.",
    inputSchema: {
      path: z.string().describe("Panel COMP operator path"),
      u: z.number().describe("Horizontal coordinate (0-1, left to right)"),
      v: z.number().describe("Vertical coordinate (0-1, bottom to top)"),
      clickCount: z
        .number()
        .optional()
        .describe("Number of clicks (1=single, 2=double, etc.) Default: 1"),
      left: z
        .boolean()
        .optional()
        .describe("Use left mouse button (default: true)"),
      middle: z
        .boolean()
        .optional()
        .describe("Use middle mouse button (default: false)"),
      right: z
        .boolean()
        .optional()
        .describe("Use right mouse button (default: false)"),
    },
  },
  async ({ path, u, v, clickCount, left, middle, right }) => {
    const result = await client.panelClick(path, u, v, {
      clickCount,
      left,
      middle,
      right,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_pane
// ---------------------------------------------------------------------------

server.registerTool(
  "td_pane",
  {
    title: "Get Pane State",
    description:
      "Get the current network editor pane state including the network " +
      "path, position (x, y), zoom level, and pane name. " +
      "Returns null if no network editor pane is active.",
    inputSchema: {},
  },
  async () => {
    const result = await client.getPane();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_selection
// ---------------------------------------------------------------------------

server.registerTool(
  "td_selection",
  {
    title: "Get Selection",
    description:
      "Get the currently selected operators in the network editor. " +
      "Returns an array of operators with path, name, type, and family.",
    inputSchema: {},
  },
  async () => {
    const result = await client.getSelection();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_bounds
// ---------------------------------------------------------------------------

server.registerTool(
  "td_bounds",
  {
    title: "Get Bounds",
    description:
      "Get the bounding box of a TouchDesigner operator including its " +
      "docked operators. Returns position (x, y), dimensions (width, height), " +
      "and docked operator details.",
    inputSchema: {
      path: z.string().describe("Operator path (e.g., '/AcroCore/AcroMCP')"),
    },
  },
  async ({ path }) => {
    const result = await client.getBounds(path);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_layout
// ---------------------------------------------------------------------------

server.registerTool(
  "td_layout",
  {
    title: "Get Layout",
    description:
      "List all direct children of a component with their positions and " +
      "dimensions, sorted by X then Y. Use this before creating new " +
      "operators to understand the existing layout and avoid overlap.",
    inputSchema: {
      path: z
        .string()
        .optional()
        .describe("Component path to inspect (default: '/')"),
    },
  },
  async ({ path }) => {
    const result = await client.getLayout(path);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_errors
// ---------------------------------------------------------------------------

server.registerTool(
  "td_errors",
  {
    title: "Check Errors",
    description:
      "Get errors and warnings for an operator and optionally its children. " +
      "Returns a list of operators that have errors or warnings, with details.",
    inputSchema: {
      path: z
        .string()
        .optional()
        .describe("Operator path to check (default: '/')"),
      recurse: z
        .boolean()
        .optional()
        .describe("Check children recursively (default: true)"),
    },
  },
  async ({ path, recurse }) => {
    const result = await client.getErrors(path, recurse);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_find_empty
// ---------------------------------------------------------------------------

server.registerTool(
  "td_find_empty",
  {
    title: "Find Empty Area",
    description:
      "Find an empty position inside a component where new operators can " +
      "be placed without overlapping existing ones. Returns x, y coordinates. " +
      "Use this before creating operators to get a clear placement position.",
    inputSchema: {
      path: z.string().describe("Component path to search in"),
      w: z
        .number()
        .optional()
        .describe("Estimated width of new operator(s) in pixels (default: 300)"),
      h: z
        .number()
        .optional()
        .describe("Estimated height of new operator(s) in pixels (default: 200)"),
      margin: z
        .number()
        .optional()
        .describe("Minimum spacing between operators in pixels (default: 50)"),
    },
  },
  async ({ path, w, h, margin }) => {
    const result = await client.findEmpty(path, w, h, margin);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// td_guide
// ---------------------------------------------------------------------------

const VALID_TOPICS = ["operators", "rendering", "glsl", "patterns", "pops", "networking", "audio"] as const;

server.registerTool(
  "td_guide",
  {
    title: "TD Guide",
    description:
      "Get curated TouchDesigner workflow guides and reference. Call with no " +
      "topic for the main guide (MCP tools, workflows, conventions, API). " +
      "Call with a topic for detailed reference: 'operators' (types, families), " +
      "'rendering' (cameras, lights, materials, instancing), 'glsl' (shaders, " +
      "uniforms), 'patterns' (layout, debugging, feedback loops), 'pops' " +
      "(GPU particles, Point Operators, POPs vs SOPs), 'networking' (OSC, MIDI, " +
      "DMX, Serial, UDP/TCP, WebSockets, NDI), 'audio' (audio CHOPs, analysis, " +
      "synthesis, mixing). Use td_help for official docs on specific operators/classes.",
    inputSchema: {
      topic: z
        .enum(VALID_TOPICS)
        .optional()
        .describe(
          "Reference topic. Omit for main guide. " +
          "Options: operators, rendering, glsl, patterns, pops, networking, audio"
        ),
    },
  },
  async ({ topic }) => {
    const filename = topic ? `${topic}.md` : "guide.md";
    const filepath = resolve(REFERENCE_DIR, filename);
    try {
      const content = readFileSync(filepath, "utf-8");
      return {
        content: [{ type: "text" as const, text: content }],
      };
    } catch {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: Could not read reference file '${filename}'. ` +
              `Valid topics: ${VALID_TOPICS.join(", ")}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// td_help
// ---------------------------------------------------------------------------

server.registerTool(
  "td_help",
  {
    title: "TD Help Lookup",
    description:
      "Look up official TouchDesigner documentation. " +
      "Query by operator name (e.g., 'Noise CHOP', 'Composite TOP'), " +
      "Python class (e.g., 'NoiseCHOP Class'), or topic (e.g., 'GLSL TOP'). " +
      "Returns the full documentation page with parameters and descriptions. " +
      "Uses offline help when available, falls back to docs.derivative.ca for " +
      "newer content (like POPs) or when offline help is unavailable.",
    inputSchema: {
      query: z
        .string()
        .describe(
          "Operator name, Python class name, or topic " +
          "(e.g., 'Noise CHOP', 'NoiseCHOP Class', 'Render TOP')"
        ),
    },
  },
  async ({ query }) => {
    const result = await helpLookup(query);
    return {
      content: [{ type: "text" as const, text: result }],
    };
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
