/** Stable heading-id slugifier shared by the renderer and the on-page TOC. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Flatten React children of a heading into plain text for slug/label use. */
export function nodeText(node: unknown): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (typeof node === "object" && "props" in (node as Record<string, unknown>)) {
    const props = (node as { props?: { children?: unknown } }).props;
    return nodeText(props?.children);
  }
  return "";
}

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Extract h2/h3 headings from raw markdown for the on-page table of contents. */
export function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  let inFence = false;
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.*)$/.exec(line);
    if (!m) continue;
    const hashes = m[1] ?? "";
    const rawText = m[2] ?? "";
    const level = (hashes.length === 2 ? 2 : 3) as 2 | 3;
    // Support explicit {#custom-id} anchors.
    const explicit = /\{#([\w-]+)\}\s*$/.exec(rawText);
    const text = rawText.replace(/\s*\{#[\w-]+\}\s*$/, "").replace(/[`*_~]/g, "").trim();
    const id = explicit?.[1] ?? slugify(text);
    items.push({ id, text, level });
  }
  return items;
}

/** Strip an explicit `{#id}` suffix from heading text and return both. */
export function parseHeading(text: string): { label: string; id: string } {
  const explicit = /\{#([\w-]+)\}\s*$/.exec(text);
  const label = text.replace(/\s*\{#[\w-]+\}\s*$/, "").trim();
  return { label, id: explicit?.[1] ?? slugify(label) };
}
