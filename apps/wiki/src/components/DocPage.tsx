import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ALL_PAGES, type DocPage as Doc } from "../content";
import { extractToc } from "./slug";
import Markdown from "./Markdown";
import Toc from "./Toc";

export default function DocPage({ page }: { page: Doc }) {
  const { hash } = useLocation();
  const toc = useMemo(() => extractToc(page.markdown), [page.markdown]);

  const index = ALL_PAGES.findIndex((p) => p.file === page.file);
  const prev = index > 0 ? ALL_PAGES[index - 1] : undefined;
  const next = index < ALL_PAGES.length - 1 ? ALL_PAGES[index + 1] : undefined;

  // Scroll to top on page change, or to the anchor if one is present.
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [page.file, hash]);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] gap-10 px-6 py-10 lg:px-10">
      <article className="min-w-0 max-w-[760px] flex-1">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-line pb-4">
          <span className="text-xs uppercase tracking-wider text-muted">Veritas documentation</span>
          <a
            href={`/md/${page.file}.md`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1 text-xs text-muted transition-colors hover:border-scoring/40 hover:text-fg"
            title="Fetch this page as raw markdown — for LLMs and agents"
          >
            <span aria-hidden>{"</>"}</span>
            View as Markdown
          </a>
        </div>

        <Markdown>{page.markdown}</Markdown>

        <nav className="mt-14 grid grid-cols-2 gap-4 border-t border-line pt-6">
          {prev ? (
            <Link
              to={`/${prev.slug}`}
              className="group rounded-lg border border-line bg-panel p-4 transition-colors hover:border-scoring/40"
            >
              <div className="text-xs text-muted">← Previous</div>
              <div className="mt-1 font-medium text-fg group-hover:text-scoring">{prev.title}</div>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              to={`/${next.slug}`}
              className="group rounded-lg border border-line bg-panel p-4 text-right transition-colors hover:border-scoring/40"
            >
              <div className="text-xs text-muted">Next →</div>
              <div className="mt-1 font-medium text-fg group-hover:text-scoring">{next.title}</div>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>

      <aside className="hidden w-56 shrink-0 xl:block">
        <div className="sticky top-10">
          <Toc items={toc} />
        </div>
      </aside>
    </div>
  );
}
