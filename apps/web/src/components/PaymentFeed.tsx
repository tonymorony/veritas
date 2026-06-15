import { AnimatePresence, motion } from "framer-motion";
import type { RoundResult } from "../sim/types";
import { Panel } from "./ui";
import { fmtUsd } from "./lib";

export function PaymentFeed({ result }: { result: RoundResult }) {
  const workerById = new Map(result.assigned.map((w) => [w.id, w]));
  const total = result.txs.reduce((a, t) => a + t.amount, 0);

  return (
    <Panel
      title="Circle nanopayment feed"
      hint={`${result.txs.length} settled · ${fmtUsd(total)} total`}
    >
      <div className="max-h-44 space-y-1.5 overflow-y-auto p-3">
        <AnimatePresence initial={false} mode="popLayout">
          {result.txs.length === 0 && (
            <p className="py-3 text-center text-xs text-muted">No payouts this Round.</p>
          )}
          {result.txs.map((tx, i) => {
            const label = workerById.get(tx.worker)?.label ?? tx.worker;
            return (
              <motion.div
                key={`${result.roundId}-${tx.hash}`}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.06, type: "spring", stiffness: 320, damping: 26 }}
                className="flex items-center gap-2 rounded-lg border border-line/60 bg-ink/40 px-2.5 py-1.5 text-xs"
              >
                <span className="text-honest">✓</span>
                <span className="text-muted">Settled</span>
                <span className="truncate text-fg">{label}</span>
                <span className="tnum ml-auto text-honest">{fmtUsd(tx.amount)}</span>
                <span className="tnum hidden text-muted/70 lg:inline">{tx.hash}</span>
                <span className="tnum text-muted">{tx.latencyMs}ms</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Panel>
  );
}
