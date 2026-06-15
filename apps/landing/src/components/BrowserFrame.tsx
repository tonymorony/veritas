import type { ReactNode } from "react";

export function BrowserFrame({
  src,
  alt,
  url = "veritas.local / dashboard",
  badge,
  className = "",
  glow = "scoring",
}: {
  src: string;
  alt: string;
  url?: string;
  badge?: ReactNode;
  className?: string;
  glow?: "scoring" | "honest" | "slash" | "none";
}) {
  const glowClass =
    glow === "none"
      ? ""
      : glow === "honest"
        ? "glow-honest"
        : glow === "slash"
          ? "shadow-[0_30px_80px_-30px_rgba(255,92,92,0.35)] ring-1 ring-slash/25"
          : "glow-scoring";

  return (
    <div
      className={`overflow-hidden rounded-xl border border-line bg-panel-2/80 ${glowClass} ${className}`}
    >
      {/* chrome bar */}
      <div className="flex items-center gap-3 border-b border-line/80 bg-panel px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slash/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-honest/70" />
        </div>
        <div className="mx-auto flex w-full max-w-sm items-center justify-center gap-2 rounded-md border border-line bg-ink/60 px-3 py-1">
          <svg viewBox="0 0 16 16" className="h-3 w-3 text-muted" fill="none" aria-hidden="true">
            <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          <span className="truncate font-mono text-[11px] text-muted">{url}</span>
        </div>
        {badge && <div className="absolute right-4">{badge}</div>}
      </div>
      <img src={src} alt={alt} loading="lazy" className="block w-full" />
    </div>
  );
}
