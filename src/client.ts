/**
 * AcroMCP HTTP API Client
 * Typed wrapper for the Acro TD Core AcroMCP webserver endpoints.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// --- Instance Registry Types ---

export interface TDInstance {
  port: number;
  project_name: string;
  project_path: string;
  pid: number;
  started: string;
}

interface InstanceRegistry {
  instances: TDInstance[];
}

// --- Registry Functions ---

function getRegistryPath(): string {
  return path.join(os.tmpdir(), "acro-td-mcp-instances.json");
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readRegistry(): TDInstance[] {
  const registryPath = getRegistryPath();
  if (!fs.existsSync(registryPath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(registryPath, "utf-8");
    const registry: InstanceRegistry = JSON.parse(data);
    const instances = registry.instances || [];
    // Filter out entries whose PID is no longer running
    return instances.filter((inst) => isProcessRunning(inst.pid));
  } catch {
    return [];
  }
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase();
}

function findInstanceForCwd(instances: TDInstance[]): TDInstance | null {
  if (instances.length === 0) return null;

  const cwd = normalizePath(process.cwd());

  // First try exact match
  for (const inst of instances) {
    if (normalizePath(inst.project_path) === cwd) {
      return inst;
    }
  }

  // Then try if CWD is inside a project path
  for (const inst of instances) {
    const projectPath = normalizePath(inst.project_path);
    if (cwd.startsWith(projectPath + "/") || cwd === projectPath) {
      return inst;
    }
  }

  // Finally try if a project path is inside CWD (less common but possible)
  for (const inst of instances) {
    const projectPath = normalizePath(inst.project_path);
    if (projectPath.startsWith(cwd + "/")) {
      return inst;
    }
  }

  // No match, return first available
  return instances[0];
}

// --- Types ---

export interface HealthResult {
  status: string;
  td_version: string;
  td_build: string;
  project: string;
  osName: string;
}

export interface ExecResult {
  success: boolean;
  result?: unknown;
  type?: string;
  stdout: string;
  stderr: string;
  from_op: string;
  error?: string;
  traceback?: string;
}

export interface OpInfo {
  op: {
    name: string;
    path: string;
    type: string;
    family: string;
    params: Record<string, unknown>;
  };
}

export interface ChildInfo {
  name: string;
  path: string;
  type: string;
  family: string;
}

export interface ChildrenResult {
  path: string;
  children: ChildInfo[];
}

export interface ParResult {
  name: string;
  value: unknown;
  default: unknown;
  type: string;
  label: string;
  page: string;
}

export interface SetParResult {
  ok: boolean;
  name: string;
  value: unknown;
}

export interface TopPreviewResult {
  path: string;
  name: string;
  type: string;
  width: number;
  height: number;
  file: string;
}

export interface PanelPreviewResult {
  path: string;
  name: string;
  type: string;
  width: number;
  height: number;
  file: string;
}

export interface PanelClickResult {
  ok: boolean;
  path: string;
  u: number;
  v: number;
  clickCount: number;
}

export interface PaneInfo {
  networkPath: string;
  x: number;
  y: number;
  zoom: number;
  name: string;
}

export interface PaneResult {
  pane: PaneInfo | null;
}

export interface SelectionResult {
  operators: Array<{
    path: string;
    name: string;
    type: string;
    family: string;
  }>;
}

export interface BoundsResult {
  path: string;
  name: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
    docked: Array<{
      name: string;
      path: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  };
}

export interface LayoutChild {
  name: string;
  path: string;
  type: string;
  family: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  path: string;
  children: LayoutChild[];
}

export interface ErrorEntry {
  path: string;
  name: string;
  type: string;
  errors: string[];
  warnings: string[];
}

export interface ErrorsResult {
  path: string;
  count: number;
  errors: ErrorEntry[];
}

export interface FindEmptyResult {
  path: string;
  position: { x: number; y: number };
}

// --- Client ---

export class AcroMCPClient {
  private baseUrl: string;
  private selectedInstance: TDInstance | null = null;

  constructor() {
    // Check for explicit port override first
    const envPort = process.env.ACRO_TD_MCP_PORT;
    if (envPort) {
      this.baseUrl = `http://localhost:${envPort}`;
      return;
    }

    // Auto-select instance from registry
    const instances = readRegistry();
    const instance = findInstanceForCwd(instances);
    if (instance) {
      this.selectedInstance = instance;
      this.baseUrl = `http://localhost:${instance.port}`;
    } else {
      // Fallback to default port if no instances found
      this.baseUrl = "http://localhost:54200";
    }
  }

  /**
   * Get all registered TD instances
   */
  getInstances(): TDInstance[] {
    return readRegistry();
  }

  /**
   * Get the currently selected instance
   */
  getSelectedInstance(): TDInstance | null {
    return this.selectedInstance;
  }

  /**
   * Switch to a different instance by port or project name
   */
  selectInstance(portOrName: number | string): TDInstance | null {
    const instances = readRegistry();
    let instance: TDInstance | undefined;

    if (typeof portOrName === "number") {
      instance = instances.find((i) => i.port === portOrName);
    } else {
      instance = instances.find(
        (i) => i.project_name.toLowerCase() === portOrName.toLowerCase()
      );
    }

    if (instance) {
      this.selectedInstance = instance;
      this.baseUrl = `http://localhost:${instance.port}`;
      return instance;
    }
    return null;
  }

  private async fetch(path: string, options?: RequestInit): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, options);
    } catch (err) {
      throw new Error(
        `Cannot connect to TouchDesigner at ${this.baseUrl}. ` +
        `Is TouchDesigner running with AcroMCP active?`
      );
    }
    return res.json();
  }

  async health(): Promise<HealthResult> {
    return this.fetch("/") as Promise<HealthResult>;
  }

  async execute(code: string, fromOp?: string): Promise<ExecResult> {
    const body: Record<string, string> = { code };
    if (fromOp) body.from_op = fromOp;
    return this.fetch("/api/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as Promise<ExecResult>;
  }

  async getOp(path: string, extra?: string): Promise<OpInfo> {
    const params = new URLSearchParams({ path });
    if (extra) params.set("extra", extra);
    return this.fetch(`/api/op?${params}`) as Promise<OpInfo>;
  }

  async getChildren(
    path?: string, depth?: number, tags?: string
  ): Promise<ChildrenResult> {
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    if (depth !== undefined) params.set("depth", String(depth));
    if (tags) params.set("tags", tags);
    return this.fetch(`/api/children?${params}`) as Promise<ChildrenResult>;
  }

  async getPar(path: string, name: string): Promise<ParResult> {
    const params = new URLSearchParams({ path, name });
    return this.fetch(`/api/par?${params}`) as Promise<ParResult>;
  }

  async setPar(
    path: string, name: string, value: unknown
  ): Promise<SetParResult> {
    return this.fetch("/api/par", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, name, value }),
    }) as Promise<SetParResult>;
  }

  async getTopPreview(path: string): Promise<TopPreviewResult> {
    const params = new URLSearchParams({ path });
    return this.fetch(`/api/top?${params}`) as Promise<TopPreviewResult>;
  }

  async getPanelPreview(path: string): Promise<PanelPreviewResult> {
    // Phase 1: Start capture
    const startResp = (await this.fetch("/api/panel/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    })) as { status: string; file?: string; error?: string };

    if (startResp.error) {
      throw new Error(startResp.error);
    }

    // Phase 2: Poll for result (max 20 attempts, 50ms apart = 1000ms total)
    // Needs ~4 frames: set path, set resolution, save, cleanup
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));

      const result = (await this.fetch("/api/panel/result")) as {
        status: string;
      } & Partial<PanelPreviewResult>;

      if (result.status === "ready") {
        return result as PanelPreviewResult;
      }
    }

    throw new Error("Panel capture timed out");
  }

  async panelClick(
    path: string,
    u: number,
    v: number,
    options?: { clickCount?: number; left?: boolean; middle?: boolean; right?: boolean }
  ): Promise<PanelClickResult> {
    const body: Record<string, unknown> = { path, u, v };
    if (options?.clickCount !== undefined) body.clickCount = options.clickCount;
    if (options?.left !== undefined) body.left = options.left;
    if (options?.middle !== undefined) body.middle = options.middle;
    if (options?.right !== undefined) body.right = options.right;

    return this.fetch("/api/panel/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as Promise<PanelClickResult>;
  }

  async getPane(): Promise<PaneResult> {
    return this.fetch("/api/editor/pane") as Promise<PaneResult>;
  }

  async getSelection(): Promise<SelectionResult> {
    return this.fetch("/api/editor/selection") as Promise<SelectionResult>;
  }

  async getBounds(path: string): Promise<BoundsResult> {
    const params = new URLSearchParams({ path });
    return this.fetch(`/api/bounds?${params}`) as Promise<BoundsResult>;
  }

  async getLayout(path?: string): Promise<LayoutResult> {
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    return this.fetch(`/api/layout?${params}`) as Promise<LayoutResult>;
  }

  async getErrors(path?: string, recurse?: boolean): Promise<ErrorsResult> {
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    if (recurse !== undefined) params.set("recurse", String(recurse));
    return this.fetch(`/api/errors?${params}`) as Promise<ErrorsResult>;
  }

  async findEmpty(
    path: string, w?: number, h?: number, margin?: number
  ): Promise<FindEmptyResult> {
    const params = new URLSearchParams({ path });
    if (w !== undefined) params.set("w", String(w));
    if (h !== undefined) params.set("h", String(h));
    if (margin !== undefined) params.set("margin", String(margin));
    return this.fetch(`/api/find-empty?${params}`) as Promise<FindEmptyResult>;
  }
}
