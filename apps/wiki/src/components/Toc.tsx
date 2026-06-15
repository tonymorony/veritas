import { useEffect, useState } from "react";
import type { TocItem } from "./slug";

/** On-page table of contents with scroll-spy highlighting. */
export default function Toc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (items.length === 0) return;
    const headings = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  return (
    <nav aria-label="On this page" className="text-sm">
      <div className="pb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted">
        On this page
      </div>
      <ul className="space-y-1 border-l border-line">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={[
                  "-ml-px block border-l py-0.5 leading-snug transition-colors",
                  item.level === 3 ? "pl-6" : "pl-3",
                  active
                    ? "border-scoring font-medium text-fg"
                    : "border-transparent text-muted hover:text-fg",
                ].join(" ")}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
