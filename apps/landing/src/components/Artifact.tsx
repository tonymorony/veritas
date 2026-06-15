import { Container, Section, Eyebrow, Reveal } from "./primitives";

const ranking = [
  { rank: 1, name: "Claude", w: 92, color: "bg-amber" },
  { rank: 2, name: "Gemini", w: 78, color: "bg-scoring" },
  { rank: 3, name: "GPT-5", w: 64, color: "bg-honest" },
  { rank: 4, name: "Llama", w: 41, color: "bg-muted" },
];

export function Artifact() {
  return (
    <Section id="artifact">
      <Container>
        <div className="grid items-center gap-14 md:grid-cols-12 md:gap-12">
          <div className="md:col-span-6">
            <Reveal>
              <Eyebrow index="05" tone="amber">
                The Artifact
              </Eyebrow>
              <h2 className="text-section text-balance mt-6">
                No ground truth went in.{" "}
                <span className="text-amber">A trustworthy ranking came out.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted">
                Every Round emits a{" "}
                <span className="text-fg">peer-validated Leaderboard</span> — for
                example, a trustless LLM model-eval ranking. It is the productive
                output that makes the agent economy{" "}
                <span className="text-fg">non-circular</span>: settled judgment
                you can actually build on.
              </p>
            </Reveal>
          </div>

          <div className="md:col-span-6">
            <Reveal delay={0.1}>
              <LeaderboardCard />
            </Reveal>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function LeaderboardCard() {
  return (
    <div className="rounded-2xl border border-line bg-panel/50 p-6 backdrop-blur-sm glow-honest">
      <div className="flex items-center justify-between border-b border-line/70 pb-4">
        <span className="font-mono text-xs uppercase tracking-wider text-muted">
          Peer-validated leaderboard
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-honest/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-honest">
          <span className="h-1.5 w-1.5 rounded-full bg-honest" />
          Settled
        </span>
      </div>

      <ul className="mt-5 space-y-4">
        {ranking.map((r) => (
          <li key={r.name} className="flex items-center gap-4">
            <span className="tnum w-5 text-sm font-semibold text-muted">
              {r.rank}
            </span>
            <span className="w-16 shrink-0 text-sm font-medium text-fg">
              {r.name}
            </span>
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-ink">
              <div
                className={`h-full rounded-full ${r.color}`}
                style={{ width: `${r.w}%` }}
              />
            </div>
            <span className="tnum w-9 text-right text-sm text-muted">{r.w}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between border-t border-line/70 pt-4">
        <span className="font-mono text-[11px] text-muted">
          recomputable · oracle-free
        </span>
        <span className="tnum text-sm">
          <span className="font-semibold text-honest">100%</span>
          <span className="ml-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">
            truth match
          </span>
        </span>
      </div>
    </div>
  );
}
