import { AnimatePresence, motion } from "framer-motion";
import type { RoundResult, SimWorker } from "../sim/types";
import { Panel, TierBadge } from "./ui";
import { ARCHETYPE_DOT, ARCHETYPE_LABEL, modelStyle } from "./lib";

function Cell({ model, col, row }: { model: string; col: number; row: number }) {
  const s = modelStyle(model);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.02 * col + 0.04 * row, type: "spring", stiffness: 400, damping: 26 }}
      className="flex h-7 w-7 items-center justify-center rounded-[5px] text-[11px] font-semibold tnum"
      style={{ background: s.soft, color: s.hue, border: `1px solid ${s.hue}33` }}
      title={model}
    >
      {s.letter}
    </motion.div>
  );
}

function WorkerRow({
  worker,
  answers,
  slashed,
  paid,
  rowIndex,
}: {
  worker: SimWorker;
  answers: string[];
  slashed: boolean;
  paid: boolean;
  rowIndex: number;
}) {
  const tint = slashed
    ? "border-slash/30 bg-slash/[0.06]"
    : paid
      ? "border-honest/25 bg-honest/[0.05]"
      : "border-line bg-transparent";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className={`flex items-center gap-3 rounded-lg border px-3 py-1.5 ${tint}`}
    >
      <div className="flex w-40 shrink-0 items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: ARCHETYPE_DOT[worker.archetype] }}
          title={ARCHETYPE_LABEL[worker.archetype]}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm text-fg">{worker.label}</span>
            <TierBadge tier={worker.tier} />
          </div>
          <span className="tnum text-[10px] text-muted">
            rep {worker.reputation >= 0 ? "" : ""}
            {worker.reputation.toFixed(3)}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {answers.map((a, i) => (
          <Cell key={i} model={a} col={i} row={rowIndex} />
        ))}
      </div>
      <div className="ml-auto w-16 shrink-0 text-right">
        {slashed ? (
          <span className="rounded bg-slash/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slash">
            slashed
          </span>
        ) : paid ? (
          <span className="rounded bg-honest/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-honest">
            paid
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}

export function WorkerGrid({ result }: { result: RoundResult }) {
  const models = result.models;
  const slashedSet = new Set(result.scores.filter((s) => s.slashed).map((s) => s.worker));

  return (
    <Panel
      title="Worker × task grid"
      hint="Each cell = the model a worker judged best for that task"
      right={
        <div className="flex items-center gap-3">
          {models.map((m) => {
            const s = modelStyle(m);
            return (
              <span key={m} className="flex items-center gap-1.5 text-[11px] text-muted">
                <span
                  className="flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold tnum"
                  style={{ background: s.soft, color: s.hue }}
                >
                  {s.letter}
                </span>
                {m}
              </span>
            );
          })}
        </div>
      }
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        <AnimatePresence initial={false}>
          {result.assigned.map((w, idx) => (
            <WorkerRow
              key={w.id}
              worker={w}
              rowIndex={idx}
              answers={result.grid[w.id] ?? []}
              slashed={slashedSet.has(w.id)}
              paid={!slashedSet.has(w.id)}
            />
          ))}
        </AnimatePresence>

        {result.excludedSybils.length > 0 && (
          <div className="mt-2 rounded-lg border border-dashed border-line/70 bg-ink/30 px-3 py-2">
            <span className="text-[11px] text-muted">
              <span className="text-amber">⊘ {result.excludedSybils.length} Sybil(s)</span> crowded out
              by the reputable-majority floor — they never entered the Round.
            </span>
          </div>
        )}
      </div>
    </Panel>
  );
}
