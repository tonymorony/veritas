// Copies every content .md into public/md/ and regenerates public/llms.txt.
// Run via `node scripts/gen-llms.mjs`; wired into the build through package.json.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url)) + "/..";
const contentDir = join(root, "src/content");
const mdOutDir = join(root, "public/md");
mkdirSync(mdOutDir, { recursive: true });

// Parse the ordered page list out of src/content/index.ts (single source of truth).
const indexTs = readFileSync(join(contentDir, "index.ts"), "utf8");
const pageRe =
  /slug:\s*"([^"]*)",\s*file:\s*"([^"]+)",\s*title:\s*"([^"]+)",\s*description:\s*\n?\s*"([^"]+)"/g;
const pages = [];
let m;
while ((m = pageRe.exec(indexTs)) !== null) {
  pages.push({ slug: m[1], file: m[2], title: m[3], description: m[4] });
}
if (pages.length === 0) throw new Error("gen-llms: no pages parsed from index.ts");

// Copy each markdown file into public/md/.
for (const file of readdirSync(contentDir)) {
  if (file.endsWith(".md")) copyFileSync(join(contentDir, file), join(mdOutDir, file));
}

const lines = [];
lines.push("# Veritas");
lines.push("");
lines.push(
  "> Veritas is a trustless settlement layer for subjective AI-agent work. It scores work by " +
    "peer agreement (Correlated Agreement) instead of an oracle, making honest reporting the " +
    "dominant strategy. Built on Circle + Arc with x402 access payments and Gateway nanopayments.",
);
lines.push("");
lines.push(
  "Each page is available as clean, structured markdown at the /md/<name>.md URLs below. " +
    "A live demo dashboard runs at http://localhost:4173.",
);
lines.push("");
lines.push("## Docs");
lines.push("");
for (const p of pages) {
  lines.push(`- [${p.title}](/md/${p.file}.md): ${p.description}`);
}
lines.push("");

writeFileSync(join(root, "public/llms.txt"), lines.join("\n"));
console.log(`gen-llms: wrote ${pages.length} pages to public/md/ and public/llms.txt`);
