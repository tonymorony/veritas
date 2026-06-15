import { motion } from "framer-motion";
import type { RoundResult } from "../sim/types";
import { Panel } from "./ui";
import { modelStyle } from "./lib";

export function Leaderboard({ result }: { result: RoundResult }) {
  const max = Math.max(1, ...result.leaderboard.map((r) => r.peerWins));
  const truthPct = Math.round(result.truthMatch * 100);
  const inverted = result.inverted;

  return (
    <Panel
      title="Peer-validated leaderboard"
      hint="No ground truth went in — a trustworthy ranking came out"
      className={inverted ? "border-slash/40" : "border-honest/25"}
      right={
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted">truth match</div>
          <motion.div
            key={truthPct}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className={`tnum text-lg font-semibold ${
              inverted ? "text-slash" : truthPct >= 70 ? "text-honest" : "text-amber"
            }`}
          >
            {truthPct}%
          </motion.div>
        </div>
      }
    >
      <div className="space-y-2 p-3">
        {result.leaderboard.map((row, i) => {
          const s = modelStyle(row.model);
          return (
            <div key={row.model} className="flex items-center gap-2.5">
              <span className="tnum w-4 text-center text-xs text-muted">{i + 1}</span>
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold tnum"
                style={{ background: s.soft, color: s.hue }}
              >
                {s.letter}
              </span>
              <span className="w-16 shrink-0 text-sm text-fg">{row.model}</span>
              <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-panel-2">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: s.hue }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(row.peerWins / max) * 100}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20, delay: i * 0.05 }}
                />
              </div>
              <span className="tnum w-8 shrink-0 text-right text-xs text-fg">{row.peerWins}</span>
            </div>
          );
        })}
      </div>
      <footer className="border-t border-line px-3 py-2.5 text-[11px] text-muted">
        {inverted ? (
          <span className="text-slash">
            Ranking is rigged — the Sybil cartel pumped {result.params.sybilTarget}.
          </span>
        ) : (
          <span>
            <span className="text-honest">{truthPct}%</span> of tasks ranked the true-best model first,
            with zero oracle.
          </span>
        )}
      </footer>
    </Panel>
  );
}
