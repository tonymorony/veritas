import { motion } from "framer-motion";
import type { RoundResult } from "../sim/types";

export function RefusedBanner({ result }: { result: RoundResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border border-amber/30 bg-gradient-to-b from-amber/[0.07] to-transparent p-10 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber/40 bg-amber/10 text-2xl text-amber">
        ⏸
      </div>
      <h2 className="text-xl font-semibold text-fg">Round refused</h2>
      <p className="mt-2 max-w-md text-sm text-muted">
        The protocol cannot guarantee a reputable majority for this Round, so it declined to run it.
        <span className="text-amber"> Sybils can never become a majority (ADR-0005).</span>
      </p>
      {result.refusedReason && (
        <code className="mt-4 rounded-lg border border-line bg-ink/60 px-3 py-2 text-xs text-muted">
          {result.refusedReason}
        </code>
      )}
    </motion.div>
  );
}

export function InvertedRibbon() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-lg border border-slash/50 bg-slash/10 px-4 py-2.5"
    >
      <motion.span
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        className="text-lg text-slash"
      >
        ⚠
      </motion.span>
      <div className="text-sm">
        <span className="font-semibold text-slash">CA inverted — a Sybil majority captured this Round.</span>
        <span className="ml-1 text-muted">
          Honest Workers were slashed and the leaderboard is rigged. This is exactly what the
          majority floor prevents.
        </span>
      </div>
    </motion.div>
  );
}
