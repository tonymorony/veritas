import {
  Container,
  Section,
  Eyebrow,
  Reveal,
  RevealGroup,
  RevealItem,
} from "./primitives";

const steps = [
  {
    n: "①",
    label: "POST",
    title: "Requester opens a Round",
    body: "Post a batch of evaluation Tasks and fund the escrow. No answer key required — the Round is the question, not the answer.",
    accent: "scoring",
  },
  {
    n: "②",
    label: "JUDGE",
    title: "Workers are assigned & commit",
    body: "Workers are randomly assigned tasks and submit judgments via commit–reveal, so no one can copy a peer before the reveal.",
    accent: "amber",
  },
  {
    n: "③",
    label: "SETTLE",
    title: "CA scores, honest work is paid",
    body: "Correlated Agreement scores everyone off-chain. Honest work is paid in Circle nanopayments; collusion is slashed and redistributed.",
    accent: "honest",
  },
] as const;

const properties = [
  {
    k: "Truthful = dominant",
    v: "Reporting your real judgment beats every other strategy, in expectation.",
  },
  {
    k: "Collusion ≤ 0",
    v: "Coordinated and lazy/random answers score at or below zero — then get slashed.",
  },
  {
    k: "No oracle",
    v: "Scores depend only on how answers co-occur across peers. Nothing external is trusted.",
  },
  {
    k: "Recomputable",
    v: "Anyone can replay a Round from public reveals and arrive at the same scores.",
  },
];

export function Mechanism() {
  return (
    <Section id="mechanism" className="overflow-hidden">
      {/* faint dotted backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-[0.35] mask-fade-edges" />

      <Container>
        <div className="max-w-2xl">
          <Reveal>
            <Eyebrow index="02" tone="scoring">
              The Mechanism
            </Eyebrow>
            <h2 className="text-section text-balance mt-6">
              Correlated Agreement.{" "}
              <span className="text-scoring">A peer-prediction rule.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-pretty text-lg leading-relaxed text-muted">
              Score each Worker purely by how their answers{" "}
              <span className="text-fg">co-occur with peers</span> across many
              Tasks. Truthful, high-effort reporting becomes the{" "}
              <span className="text-fg">dominant strategy</span>. There is no
              judge to capture and no ground truth to fake.
            </p>
          </Reveal>
        </div>

        {/* Properties — instrument readout grid */}
        <RevealGroup className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {properties.map((p) => (
            <RevealItem key={p.k}>
              <div className="h-full bg-panel/60 p-6 transition-colors hover:bg-panel">
                <div className="font-mono text-xs font-semibold uppercase tracking-wider text-scoring">
                  {p.k}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">{p.v}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>

      {/* How it works */}
      <Container className="mt-28">
        <div id="how-it-works" className="scroll-mt-24">
          <Reveal>
            <Eyebrow index="03" tone="honest">
              How it works
            </Eyebrow>
            <h2 className="text-section text-balance mt-6 max-w-xl">
              From question to payout in one Round.
            </h2>
          </Reveal>
        </div>

        <RevealGroup className="relative mt-14 grid gap-6 md:grid-cols-3" stagger={0.12}>
          {/* connecting line */}
          <div className="pointer-events-none absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-scoring/40 via-amber/40 to-honest/50 md:block" />
          {steps.map((s) => (
            <RevealItem key={s.label}>
              <Step {...s} />
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </Section>
  );
}

function Step({
  n,
  label,
  title,
  body,
  accent,
}: {
  n: string;
  label: string;
  title: string;
  body: string;
  accent: string;
}) {
  const ring =
    accent === "scoring"
      ? "border-scoring/40 text-scoring"
      : accent === "amber"
        ? "border-amber/40 text-amber"
        : "border-honest/40 text-honest";
  return (
    <div className="relative h-full rounded-2xl border border-line bg-panel/50 p-7 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full border bg-ink text-base ${ring}`}
        >
          {n}
        </div>
        <span className={`font-mono text-[10px] uppercase tracking-[0.2em] ${ring.split(" ")[1]}`}>
          {label}
        </span>
      </div>
      <h3 className="mt-6 text-lg font-semibold text-fg">{title}</h3>
      <p className="mt-2.5 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
