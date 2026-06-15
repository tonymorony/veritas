import { NavLink } from "react-router-dom";
import { SECTIONS } from "../content";

const DEMO_URL = "http://localhost:4173";

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex h-full flex-col">
      <NavLink
        to="/"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-5 py-5"
        aria-label="Veritas docs home"
      >
        <img src="/brand/veritas-mark.svg" alt="" className="h-7 w-7" />
        <span className="flex items-baseline gap-1.5">
          <span className="text-[1.05rem] font-semibold tracking-tight text-fg">Veritas</span>
          <span className="text-[0.7rem] font-medium uppercase tracking-wider text-muted">
            Docs
          </span>
        </span>
      </NavLink>

      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-5">
            <div className="px-2 pb-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted">
              {section.title}
            </div>
            <ul className="space-y-0.5">
              {section.pages.map((page) => (
                <li key={page.file}>
                  <NavLink
                    to={`/${page.slug}`}
                    end={page.slug === ""}
                    onClick={onNavigate}
                    title={page.description}
                    className={({ isActive }) =>
                      [
                        "block rounded-md px-2 py-1.5 text-[0.9rem] leading-snug transition-colors",
                        isActive
                          ? "bg-panel-2 font-medium text-fg"
                          : "text-muted hover:bg-panel hover:text-fg",
                      ].join(" ")
                    }
                  >
                    {page.title}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-line px-4 py-4">
        <a
          href={DEMO_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center justify-center gap-2 rounded-lg border border-honest/30 bg-honest/10 px-3 py-2 text-sm font-medium text-honest transition-colors hover:bg-honest/20"
        >
          Launch demo
          <span aria-hidden>→</span>
        </a>
        <a
          href="/llms.txt"
          className="mt-2 block text-center text-xs text-muted transition-colors hover:text-fg"
        >
          llms.txt
        </a>
      </div>
    </nav>
  );
}
