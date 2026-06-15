import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import { Link } from "react-router-dom";
import { nodeText, parseHeading } from "./slug";

// A minimal syntax highlighter registering ONLY the languages the docs actually use
// (bash, ts, jsonc). rehype-highlight statically imports lowlight's full `common` set
// (~35 grammars, ~500KB), so we hand-roll the hast pass instead to keep the bundle small.
const lowlight = createLowlight({ bash, json, typescript });
lowlight.registerAlias({ typescript: ["ts"], json: ["jsonc"] });

/** hast node shapes we touch — kept loose to avoid an @types/hast dependency. */
interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
}

function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

/** Highlight `<pre><code class="language-x">` blocks for registered languages only. */
function rehypeHighlightLite() {
  return (tree: HastNode) => {
    const walk = (node: HastNode, parent: HastNode | null) => {
      if (node.tagName === "code" && parent?.tagName === "pre") {
        const classes = Array.isArray(node.properties?.className)
          ? (node.properties!.className as string[])
          : [];
        const langClass = classes.find((c) => typeof c === "string" && c.startsWith("language-"));
        const lang = langClass?.slice("language-".length);
        if (lang && lowlight.registered(lang)) {
          const result = lowlight.highlight(lang, textOf(node)) as unknown as HastNode;
          node.children = result.children;
          node.properties = node.properties ?? {};
          node.properties.className = [...new Set([...classes, "hljs"])];
        }
        return; // never recurse into code children
      }
      for (const child of node.children ?? []) walk(child, node);
    };
    walk(tree, null);
  };
}

/** A heading that carries a slug id (supports explicit {#id} anchors). */
function heading(Tag: "h2" | "h3" | "h4") {
  return function H({ children }: { children?: React.ReactNode }) {
    const { label, id } = parseHeading(nodeText(children));
    return (
      <Tag id={id} className="group scroll-mt-6">
        <a href={`#${id}`} className="no-underline" aria-label={label}>
          {label}
          <span className="ml-2 text-muted opacity-0 transition-opacity group-hover:opacity-60">
            #
          </span>
        </a>
      </Tag>
    );
  };
}

const components: Components = {
  h2: heading("h2"),
  h3: heading("h3"),
  h4: heading("h4"),
  // Internal links → SPA navigation; external/anchor links stay as <a>.
  a({ href, children }) {
    const url = href ?? "";
    const isInternal = url.startsWith("/");
    const isAnchor = url.startsWith("#");
    if (isInternal) {
      return <Link to={url}>{children}</Link>;
    }
    return (
      <a
        href={url}
        {...(isAnchor ? {} : { target: "_blank", rel: "noreferrer noopener" })}
      >
        {children}
      </a>
    );
  },
  // Images render as <figure> with the alt text as a styled caption.
  img({ src, alt }) {
    return (
      <figure>
        <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} loading="lazy" />
        {alt ? <figcaption>{alt}</figcaption> : null}
      </figure>
    );
  },
};

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-veritas">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlightLite]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
