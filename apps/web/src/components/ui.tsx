import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
  title,
  hint,
  right,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border border-line bg-panel/80 shadow-[0_1px_0_rgba(255,255,255,0.02),0_12px_30px_-18px_rgba(0,0,0,0.8)] ${className}`}
    >
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
            )}
            {hint && <p className="mt-0.5 truncate text-xs text-muted/70">{hint}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Chip({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "honest" | "scoring" | "slash" | "amber";
}) {
  const tones: Record<string, string> = {
    muted: "border-line bg-panel-2 text-muted",
    honest: "border-honest/30 bg-honest/10 text-honest",
    scoring: "border-scoring/30 bg-scoring/10 text-scoring",
    slash: "border-slash/30 bg-slash/10 text-slash",
    amber: "border-amber/30 bg-amber/10 text-amber",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function TierBadge({ tier }: { tier: "probation" | "standard" | "premium" }) {
  const map = {
    premium: "border-honest/40 bg-honest/10 text-honest",
    standard: "border-scoring/40 bg-scoring/10 text-scoring",
    probation: "border-line bg-panel-2 text-muted",
  };
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${map[tier]}`}
      title={`${tier} tier`}
    >
      {tier === "probation" ? "prob" : tier}
    </span>
  );
}
