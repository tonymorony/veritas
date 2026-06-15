import { useEffect } from "react";
import { useVeritas } from "./store/useVeritas";
import { TopBar } from "./components/TopBar";
import { ControlPanel } from "./components/ControlPanel";
import { WorkerGrid } from "./components/WorkerGrid";
import { SettlementLedger } from "./components/SettlementLedger";
import { PaymentFeed } from "./components/PaymentFeed";
import { ReputationPanel } from "./components/ReputationPanel";
import { Leaderboard } from "./components/Leaderboard";
import { RefusedBanner, InvertedRibbon } from "./components/SpecialStates";
import { Panel } from "./components/ui";

function EmptyGrid() {
  return (
    <Panel className="flex min-h-0 flex-1 items-center justify-center" title="Worker × task grid">
      <div className="p-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-panel-2 text-honest">
          ✓
        </div>
        <p className="text-sm text-muted">Run a Round to watch workers judge, get scored, and settle.</p>
      </div>
    </Panel>
  );
}

export default function App() {
  const result = useVeritas((s) => s.result);
  const history = useVeritas((s) => s.history);
  const runRound = useVeritas((s) => s.runRound);
  // subscribe to rev so this re-renders when sim.workers mutate in place
  useVeritas((s) => s.rev);

  // populate the dashboard on first mount
  useEffect(() => {
    if (!useVeritas.getState().result) runRound();
  }, [runRound]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent text-fg">
      <TopBar />
      <main className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)_380px] gap-4 p-4">
        {/* LEFT — controls */}
        <div className="min-h-0">
          <ControlPanel />
        </div>

        {/* CENTER — hero grid + leaderboard */}
        <div className="flex min-h-0 flex-col gap-4">
          {result?.inverted && <InvertedRibbon />}
          {result?.refused ? (
            <RefusedBanner result={result} />
          ) : result ? (
            <WorkerGrid result={result} />
          ) : (
            <EmptyGrid />
          )}
          {result && !result.refused && <Leaderboard result={result} />}
        </div>

        {/* RIGHT — settlement, feed, reputation */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          {result && !result.refused ? (
            <>
              <SettlementLedger result={result} />
              <PaymentFeed result={result} />
              <ReputationPanel result={result} history={history} />
            </>
          ) : (
            <Panel className="p-6" title="Settlement">
              <p className="p-2 text-sm text-muted">
                {result?.refused
                  ? "No settlement — the Round was refused before any work was done."
                  : "Settlement appears here once a Round runs."}
              </p>
            </Panel>
          )}
        </div>
      </main>
    </div>
  );
}
