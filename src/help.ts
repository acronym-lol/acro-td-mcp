/**
 * TD Help — reads from TouchDesigner's bundled documentation.
 * Falls back to fetching from https://docs.derivative.ca/ when offline help
 * is unavailable or a page isn't found locally.
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve } from "path";
import { parse as parseHTML } from "node-html-parser";

const WIKI_BASE_URL = "https://docs.derivative.ca";

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

const HELP_SUBPATH =
  "Samples/Learn/OfflineHelp/https.docs.derivative.ca";

function findHelpDir(): string | null {
  // Environment override
  if (process.env.TD_HELP_PATH) {
    return existsSync(process.env.TD_HELP_PATH)
      ? process.env.TD_HELP_PATH
      : null;
  }

  if (process.platform === "win32") {
    // Check common Windows install locations
    const candidates = [
      resolve("C:/Program Files/Derivative/TouchDesigner", HELP_SUBPATH),
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
  }

  if (process.platform === "darwin") {
    // TODO: verify macOS path
    const candidates = [
      resolve(
        "/Applications/Derivative/TouchDesigner.app/Contents/Resources",
        HELP_SUBPATH
      ),
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// File index (cached)
// ---------------------------------------------------------------------------

let cachedDir: string | null | undefined;
let cachedIndex: string[] | null = null;

function getHelpDir(): string | null {
  if (cachedDir === undefined) {
    cachedDir = findHelpDir();
  }
  return cachedDir;
}

function getIndex(): string[] | null {
  const dir = getHelpDir();
  if (!dir) return null;
  if (!cachedIndex) {
    cachedIndex = readdirSync(dir).filter((f) => f.endsWith(".htm"));
  }
  return cachedIndex;
}

// ---------------------------------------------------------------------------
// Search / match
// ---------------------------------------------------------------------------

export function findPage(query: string): { file: string } | { suggestions: string[] } {
  const index = getIndex();
  if (!index) {
    return { suggestions: [] };
  }

  // Normalize: "Noise CHOP" → "Noise_CHOP", "noiseCHOP Class" → "noiseCHOP_Class"
  const normalized = query.trim().replace(/\s+/g, "_");

  // 1. Exact match
  const exact = `${normalized}.htm`;
  if (index.includes(exact)) {
    return { file: exact };
  }

  // 2. Case-insensitive match
  const lower = normalized.toLowerCase();
  const ci = index.find((f) => f.toLowerCase() === `${lower}.htm`);
  if (ci) {
    return { file: ci };
  }

  // 3. Try common naming variants
  //    "noise chop" → "Noise_CHOP", "compositeTOP" → "Composite_TOP"
  const variants = buildVariants(normalized);
  for (const v of variants) {
    const match = index.find((f) => f.toLowerCase() === `${v.toLowerCase()}.htm`);
    if (match) return { file: match };
  }

  // 4. Partial match — return suggestions
  const matches = index
    .filter((f) => f.toLowerCase().includes(lower))
    .map((f) => f.replace(".htm", ""))
    .slice(0, 15);

  return { suggestions: matches };
}

function buildVariants(name: string): string[] {
  const variants: string[] = [];

  // Try inserting underscore before family suffix: "NoiseCHOP" → "Noise_CHOP"
  const familyMatch = name.match(
    /^(.+?)(CHOP|TOP|SOP|DAT|COMP|MAT|POP|Class)$/i
  );
  if (familyMatch) {
    const [, base, family] = familyMatch;
    const upperFamily = family.toUpperCase() === "CLASS" ? "Class" : family.toUpperCase();
    variants.push(`${base}_${upperFamily}`);
    // Also try with capitalized base: "noise" → "Noise"
    const capBase = base.charAt(0).toUpperCase() + base.slice(1);
    variants.push(`${capBase}_${upperFamily}`);
  }

  // Try appending _Class: "NoiseCHOP" → "NoiseCHOP_Class"
  if (!name.toLowerCase().includes("class")) {
    variants.push(`${name}_Class`);
  }

  return variants;
}

// ---------------------------------------------------------------------------
// HTML → text extraction
// ---------------------------------------------------------------------------

export function readPage(filename: string): string {
  const dir = getHelpDir();
  if (!dir) return "Error: TouchDesigner offline help directory not found.";

  const filepath = resolve(dir, filename);
  const html = readFileSync(filepath, "utf-8");

  // Extract title from raw HTML (full-page parse chokes on large MediaWiki pages)
  const titleMatch = html.match(/<h1[^>]*id="firstHeading"[^>]*>(.+?)<\/h1>/s);
  const title = titleMatch
    ? parseHTML(titleMatch[1]).text.trim()
    : filename.replace(".htm", "");

  // Extract inner content region — find the mw-content-text div and stop at footer/nav
  // The content div is followed by navigation, categories, and footer elements
  const contentMatch = html.match(
    /<div id="mw-content-text"[^>]*>([\s\S]+?)(?=<div[^>]*(?:id="catlinks"|class="printfooter"|id="mw-navigation"))/
  );
  if (!contentMatch) {
    // Fallback: try simpler extraction if the lookahead didn't match
    const fallbackMatch = html.match(/<div id="mw-content-text"[^>]*>([\s\S]+?)<\/div>\s*<div/);
    if (!fallbackMatch) return title || "No content found.";
    return formatContent(title, parseHTML(fallbackMatch[1]));
  }

  // Parse just the content region (much smaller, parser handles it fine)
  const content = parseHTML(contentMatch[1]);

  // Remove unwanted elements
  content.querySelectorAll("script, style, .mw-editsection, #toc, .noprint")
    .forEach((el) => el.remove());

  // Process the HTML into readable text
  const formatted = formatContent(title, content);

  // Strip any remaining boilerplate that slipped through
  return stripBoilerplate(formatted);
}

function formatContent(title: string, node: any): string {
  const lines: string[] = [];
  if (title) lines.push(`# ${title}`, "");

  // Walk through child elements
  for (const child of node.childNodes) {
    processNode(child, lines);
  }

  // Clean up excessive blank lines
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function processNode(node: any, lines: string[]): void {
  if (node.nodeType === 3) {
    // Text node
    const text = node.text?.trim();
    if (text) lines.push(text);
    return;
  }

  if (node.nodeType !== 1) return; // Skip non-element nodes

  const tag = node.tagName?.toLowerCase();

  switch (tag) {
    case "h2": {
      const text = node.text?.trim();
      if (text) lines.push("", `## ${text}`, "");
      return;
    }
    case "h3": {
      const text = node.text?.trim();
      if (text) lines.push("", `### ${text}`, "");
      return;
    }
    case "h4": {
      const text = node.text?.trim();
      if (text) lines.push("", `#### ${text}`, "");
      return;
    }
    case "p": {
      const text = node.text?.trim();
      if (text) lines.push(text, "");
      return;
    }
    case "ul":
    case "ol": {
      for (const li of node.querySelectorAll(":scope > li")) {
        const text = li.text?.trim();
        if (text) lines.push(`- ${text}`);
      }
      lines.push("");
      return;
    }
    case "div": {
      // Parameter divs have id matching the param code name
      const id = node.getAttribute("id");
      const parName = node.querySelector(
        ".parNameCHOP, .parNameTOP, .parNameSOP, .parNameDAT, .parNameCOMP, .parNameMAT"
      );
      const code = node.querySelector("code");
      if (parName && code) {
        // This is a parameter block
        const label = parName.text?.trim();
        const codeName = code.text?.trim();
        // Get description (text after the code element)
        const fullText = node.text?.trim() || "";
        // Remove the label and code from the full text to get description
        let desc = fullText;
        if (label) desc = desc.replace(label, "").trim();
        if (codeName) desc = desc.replace(codeName, "").trim();
        desc = desc.replace(/^[\s-]+/, "").trim();
        lines.push(`**${label}** \`${codeName}\` — ${desc}`);
        return;
      }
      // Generic div — recurse
      for (const c of node.childNodes) {
        processNode(c, lines);
      }
      return;
    }
    case "table": {
      // Simple table extraction
      const rows = node.querySelectorAll("tr");
      for (const row of rows) {
        const cells = row.querySelectorAll("th, td");
        const cellTexts = cells.map((c: any) => c.text?.trim() || "");
        if (cellTexts.some((t: string) => t)) {
          lines.push(cellTexts.join(" | "));
        }
      }
      lines.push("");
      return;
    }
    default: {
      // For other elements, recurse
      for (const c of node.childNodes) {
        processNode(c, lines);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Boilerplate removal
// ---------------------------------------------------------------------------

function stripBoilerplate(text: string): string {
  // Remove everything after common footer markers
  const footerMarkers = [
    /\n+TouchDesigner Build:[\s\S]*/,
    /\n+Retrieved from "[\s\S]*/,
    /\n+## Navigation menu[\s\S]*/,
    /\n+### Personal tools[\s\S]*/,
    /\n+Category\s*:[\s\S]*/,
    /\n+This page was last edited[\s\S]*/,
  ];

  let cleaned = text;
  for (const marker of footerMarkers) {
    cleaned = cleaned.replace(marker, "");
  }

  // Remove operator family link lists at the end (e.g., "COMPs\nActor • Ambient Light...")
  cleaned = cleaned.replace(
    /\n+(CHOPs|TOPs|SOPs|DATs|COMPs|MATs)\n+[\w\s•]+$/,
    ""
  );

  // Remove glossary-style definitions that appear at the end
  cleaned = cleaned.replace(
    /\n+An Operator Family that (?:contains|reads|creates|manipulates|operate)[\s\S]*$/,
    ""
  );

  return cleaned.trim();
}

// ---------------------------------------------------------------------------
// Web fallback
// ---------------------------------------------------------------------------

async function fetchFromWeb(query: string): Promise<string | null> {
  // Normalize query to wiki page name format
  const pageName = query.trim().replace(/\s+/g, "_");
  const url = `${WIKI_BASE_URL}/${encodeURIComponent(pageName)}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "AcroMCP/1.0 (TouchDesigner Help Lookup)",
      },
    });

    if (!response.ok) {
      // Try common naming variants
      const variants = buildVariants(pageName);
      for (const variant of variants) {
        const variantUrl = `${WIKI_BASE_URL}/${encodeURIComponent(variant)}`;
        const variantResponse = await fetch(variantUrl, {
          headers: {
            "User-Agent": "AcroMCP/1.0 (TouchDesigner Help Lookup)",
          },
        });
        if (variantResponse.ok) {
          const html = await variantResponse.text();
          return parseWebPage(html, variant);
        }
      }
      return null;
    }

    const html = await response.text();
    return parseWebPage(html, pageName);
  } catch (error) {
    // Network error or other issue
    return null;
  }
}

function parseWebPage(html: string, pageName: string): string {
  // Extract title
  const titleMatch = html.match(/<h1[^>]*id="firstHeading"[^>]*>(.+?)<\/h1>/s);
  const title = titleMatch
    ? parseHTML(titleMatch[1]).text.trim()
    : pageName.replace(/_/g, " ");

  // Extract content region
  const contentMatch = html.match(
    /<div id="mw-content-text"[^>]*>([\s\S]+?)(?=<div[^>]*(?:id="catlinks"|class="printfooter"|id="mw-navigation"))/
  );
  if (!contentMatch) {
    const fallbackMatch = html.match(/<div id="mw-content-text"[^>]*>([\s\S]+?)<\/div>\s*<div/);
    if (!fallbackMatch) return title || "No content found.";
    return formatContent(title, parseHTML(fallbackMatch[1]));
  }

  const content = parseHTML(contentMatch[1]);

  // Remove unwanted elements
  content.querySelectorAll("script, style, .mw-editsection, #toc, .noprint")
    .forEach((el) => el.remove());

  const formatted = formatContent(title, content);
  return stripBoilerplate(formatted);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isAvailable(): boolean {
  return getHelpDir() !== null;
}

export async function lookup(query: string): Promise<string> {
  // Try offline help first
  if (isAvailable()) {
    const result = findPage(query);

    if ("file" in result) {
      return readPage(result.file);
    }

    // No exact match in offline help — try web fallback before showing suggestions
    const webResult = await fetchFromWeb(query);
    if (webResult) {
      return webResult + "\n\n---\n*Fetched from docs.derivative.ca (not in offline help)*";
    }

    // Web also failed — show suggestions from offline help
    if (result.suggestions.length > 0) {
      return (
        `No exact match for "${query}". Did you mean:\n` +
        result.suggestions.map((s) => `- ${s}`).join("\n")
      );
    }

    return `No pages found matching "${query}". Try a different search term.`;
  }

  // Offline help not available — try web directly
  const webResult = await fetchFromWeb(query);
  if (webResult) {
    return webResult + "\n\n---\n*Fetched from docs.derivative.ca (offline help not available)*";
  }

  return (
    `No pages found matching "${query}".\n\n` +
    "Offline help not found at: " +
    (process.platform === "win32"
      ? "C:\\Program Files\\Derivative\\TouchDesigner\\" +
        "Samples\\Learn\\OfflineHelp\\https.docs.derivative.ca"
      : "/Applications/Derivative/TouchDesigner.app/...") +
    "\nSet TD_HELP_PATH environment variable to override.\n" +
    "Web lookup also failed — check your network connection."
  );
}
