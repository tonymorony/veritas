import { motion } from "framer-motion";
import type { RoundResult, SimWorker } from "../sim/types";
import { Panel } from "./ui";
import { ARCHETYPE_DOT, TIER_FLOORS } from "./lib";

// reputation (raw CA EMA) lives in roughly [-1, 1]; we render the [-0.2, 0.6] window
const REP_MIN = -0.2;
const REP_MAX = 0.6;
const pct = (rep: number) => ((Math.max(REP_MIN, Math.min(REP_MAX, rep)) - REP_MIN) / (REP_MAX - REP_MIN)) * 100;

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 48;
  const h = 16;
  const lo = REP_MIN;
  const hi = REP_MAX;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const rising = values[values.length - 1]! >= values[0]!;
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={rising ? "#3DDC97" : "#FF5C5C"}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReputationPanel({
  result,
  history,
}: {
  result: RoundResult;
  history: RoundResult[];
}) {
  // reputation trail per worker from history (raw EMA reputation snapshots)
  const trail = new Map<string, number[]>();
  for (const r of history) {
    for (const w of r.assigned) {
      if (!trail.has(w.id)) trail.set(w.id, []);
      trail.get(w.id)!.push(w.reputation);
    }
  }

  const workers: SimWorker[] = result.assigned;

  return (
    <Panel
      title="Reputation & tiers"
      hint="Persistent raw-CA EMA · probation → standard → premium (ADR-0006)"
    >
      <div className="space-y-2.5 p-3">
        {/* threshold scale legend */}
        <div className="relative h-4">
          <div className="absolute inset-x-0 top-1.5 h-px bg-line" />
          {(["standard", "premium"] as const).map((t) => (
            <div
              key={t}
              className="absolute -translate-x-1/2 text-[9px] text-muted"
              style={{ left: `${pct(TIER_FLOORS[t])}%` }}
            >
              <span className="block h-2 w-px bg-line" />
              {t}
            </div>
          ))}
        </div>

        {workers.map((w) => (
          <div key={w.id} className="flex items-center gap-2">
            <span className="flex w-24 shrink-0 items-center gap-1.5 truncate text-xs text-fg">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: ARCHETYPE_DOT[w.archetype] }} />
              {w.label}
            </span>
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-panel-2">
              {/* tier threshold marks */}
              {(["standard", "premium"] as const).map((t) => (
                <div
                  key={t}
                  className="absolute top-0 h-full w-px bg-line"
                  style={{ left: `${pct(TIER_FLOORS[t])}%` }}
                />
              ))}
              {/* zero mark */}
              <div className="absolute top-0 h-full w-px bg-muted/40" style={{ left: `${pct(0)}%` }} />
              <motion.div
                className="h-full rounded-full"
                style={{
                  background:
                    w.tier === "premium" ? "#3DDC97" : w.tier === "standard" ? "#5B8DEF" : "#8A93A6",
                }}
                initial={{ width: 0 }}
                animate={{ width: `${pct(w.reputation)}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 22 }}
              />
            </div>
            <span className="tnum w-12 shrink-0 text-right text-[10px] text-muted">
              {w.reputation.toFixed(3)}
            </span>
            <Sparkline values={trail.get(w.id) ?? []} />
          </div>
        ))}
      </div>
    </Panel>
  );
}
