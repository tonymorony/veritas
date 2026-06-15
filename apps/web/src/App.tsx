import { useMemo, useState } from "react";
import { VeritasSim } from "./sim/engine";
import type { RoundParams } from "./sim/types";

const PARAMS: RoundParams = {
  numTasks: 12,
  roundSize: 7,
  baseReward: 5,
  stake: 4,
  honestAccuracy: 0.82,
  sybilTarget: "GPT-5",
  sybilStrategy: "naive",
  enforceMajorityFloor: true,
  seed: 42,
};

export default function App() {
  const sim = useMemo(() => new VeritasSim({ honest: 5, reference: 2, sloppy: 1, sybil: 3 }), []);
  const [result, setResult] = useState(() => sim.runRound(PARAMS));

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold">
        veritas <span className="text-muted text-sm">— get paid for the truth</span>
      </h1>
      <button
        className="my-4 rounded-md bg-honest px-4 py-2 font-medium text-ink"
        onClick={() => setResult(sim.runRound(PARAMS))}
      >
        Run Round {result.roundId + 1}
      </button>

      <div className="grid grid-cols-2 gap-6">
        <section>
          <h2 className="mb-2 text-muted">Scores (round {result.roundId})</h2>
          <ul className="tnum space-y-1 text-sm">
            {result.scores.map((s) => {
              const w = result.assigned.find((a) => a.id === s.worker)!;
              return (
                <li key={s.worker} className={s.slashed ? "text-slash" : "text-honest"}>
                  {w.label} · raw {s.raw.toFixed(2)} · norm {s.normalized.toFixed(2)}
                  {s.slashed ? " · SLASHED" : ""}
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          <h2 className="mb-2 text-muted">Leaderboard · truth match {(result.truthMatch * 100).toFixed(0)}%</h2>
          <ol className="tnum space-y-1 text-sm">
            {result.leaderboard.map((r) => (
              <li key={r.model}>
                {r.model} — peer {r.peerWins} / truth {r.truthWins}
              </li>
            ))}
          </ol>
          <p className="tnum mt-4 text-sm text-muted">
            escrow {result.settlement.escrow} · refund {result.settlement.requesterRefund.toFixed(1)} ·
            treasury {result.settlement.treasury.toFixed(1)} · txs {result.txs.length}
          </p>
        </section>
      </div>
    </div>
  );
}
