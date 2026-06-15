import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Link } from "react-router-dom";
import { nodeText, parseHeading } from "./slug";

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
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
