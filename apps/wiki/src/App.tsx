import { useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { ALL_PAGES } from "./content";
import Sidebar from "./components/Sidebar";
import DocPage from "./components/DocPage";

function NotFound() {
  return (
    <div className="mx-auto max-w-[760px] px-6 py-20">
      <h1 className="text-3xl font-bold text-fg">Page not found</h1>
      <p className="mt-3 text-muted">
        That page doesn&apos;t exist. Head back to the{" "}
        <Link to="/" className="text-scoring hover:text-fg">
          introduction
        </Link>
        .
      </p>
    </div>
  );
}

export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-ink text-fg">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ink/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link to="/" className="flex items-center gap-2">
          <img src="/brand/veritas-mark.svg" alt="" className="h-6 w-6" />
          <span className="font-semibold tracking-tight">Veritas Docs</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation"
          className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-fg"
        >
          {mobileOpen ? "Close" : "Menu"}
        </button>
      </header>

      <div className="lg:flex">
        {/* Sidebar — fixed on desktop, drawer on mobile */}
        <aside className="hidden w-64 shrink-0 border-r border-line bg-ink lg:fixed lg:inset-y-0 lg:block">
          <Sidebar />
        </aside>

        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-72 border-r border-line bg-ink lg:hidden">
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </aside>
          </>
        )}

        {/* Content */}
        <main className="min-w-0 flex-1 lg:ml-64" key={location.pathname}>
          <Routes>
            {ALL_PAGES.map((page) => (
              <Route key={page.file} path={`/${page.slug}`} element={<DocPage page={page} />} />
            ))}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
