import { motion } from "framer-motion";
import type { RoundResult } from "../sim/types";
import { Panel } from "./ui";
import { ARCHETYPE_DOT, fmtUsd } from "./lib";

export function SettlementLedger({ result }: { result: RoundResult }) {
  const workerById = new Map(result.assigned.map((w) => [w.id, w]));
  const rows = result.settlement.workers;
  // scale bars to the largest single gross flow this round
  const maxFlow = Math.max(
    1,
    ...rows.map((w) => Math.max(w.reward + w.redistribution, w.slashed)),
  );
  const s = result.settlement;

  return (
    <Panel title="Settlement ledger" hint="Reward + redistribution vs. slashed stake">
      <div className="space-y-2 p-3">
        {rows.map((w, i) => {
          const worker = workerById.get(w.worker);
          const credit = w.reward + w.redistribution;
          const isSlashed = w.slashed > 0;
          return (
            <motion.div
              key={w.worker}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-lg border border-line/70 bg-ink/30 px-3 py-2"
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-fg">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: ARCHETYPE_DOT[worker?.archetype ?? "honest"] }}
                  />
                  {worker?.label ?? w.worker}
                </span>
                <span className="tnum text-muted">
                  {isSlashed ? (
                    <span className="text-slash">−{fmtUsd(w.slashed)}</span>
                  ) : (
                    <span className="text-honest">+{fmtUsd(credit)}</span>
                  )}
                </span>
              </div>
              {/* bar */}
              <div className="relative h-2 overflow-hidden rounded-full bg-panel-2">
                <motion.div
                  className={isSlashed ? "h-full rounded-full bg-slash" : "h-full rounded-full bg-honest"}
                  initial={{ width: 0 }}
                  animate={{ width: `${((isSlashed ? w.slashed : credit) / maxFlow) * 100}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20, delay: i * 0.03 + 0.1 }}
                />
                {w.redistribution > 0 && (
                  <motion.div
                    className="absolute top-0 h-full bg-scoring/70"
                    initial={{ width: 0, left: `${(w.reward / maxFlow) * 100}%` }}
                    animate={{ width: `${(w.redistribution / maxFlow) * 100}%` }}
                    transition={{ delay: i * 0.03 + 0.35, type: "spring", stiffness: 120, damping: 20 }}
                    title="redistributed from slashed stake"
                  />
                )}
              </div>
              <div className="mt-1 flex gap-3 tnum text-[10px] text-muted">
                <span>reward {fmtUsd(w.reward)}</span>
                <span>stake↩ {fmtUsd(w.stakeReturned)}</span>
                {w.redistribution > 0 && (
                  <span className="text-scoring">+redist {fmtUsd(w.redistribution)}</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <footer className="grid grid-cols-3 gap-2 border-t border-line px-3 py-3 text-center">
        {[
          { k: "Escrow", v: s.escrow, tone: "text-fg" },
          { k: "Refund", v: s.requesterRefund, tone: "text-muted" },
          { k: "Treasury", v: s.treasury, tone: s.treasury > 0 ? "text-amber" : "text-muted" },
        ].map((x) => (
          <div key={x.k} className="rounded-lg bg-ink/40 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted">{x.k}</div>
            <div className={`tnum text-sm font-semibold ${x.tone}`}>{fmtUsd(x.v)}</div>
          </div>
        ))}
      </footer>
    </Panel>
  );
}
