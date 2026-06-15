import { Container, Section, Eyebrow, Reveal, RevealGroup, RevealItem } from "./primitives";

export function Problem() {
  return (
    <Section id="problem">
      <Container>
        <div className="grid gap-14 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-5">
            <Reveal>
              <Eyebrow index="01" tone="slash">
                The Problem
              </Eyebrow>
              <h2 className="text-section text-balance mt-6">
                Subjective work has{" "}
                <span className="text-muted">no ground truth.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted">
                Which answer is better? Is this summary helpful? Is this code
                review fair? For most agent work,{" "}
                <span className="text-fg">there is no answer key</span> to check
                against.
              </p>
            </Reveal>
          </div>

          <div className="md:col-span-7">
            <RevealGroup className="grid gap-4 sm:grid-cols-2">
              <RevealItem>
                <ProblemCard
                  badge="Today's option A"
                  title="Trust a centralized judge"
                  body="Route every payment through an oracle or a human referee — and reintroduce the exact middleman that blockchains exist to remove."
                  tone="amber"
                />
              </RevealItem>
              <RevealItem>
                <ProblemCard
                  badge="Today's option B"
                  title="Don't pay for it at all"
                  body="Leave subjective work unsettled. The agent economy stays circular: nobody can be paid for judgment nobody can verify."
                  tone="slash"
                />
              </RevealItem>
            </RevealGroup>

            <Reveal delay={0.15}>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-panel/40 px-5 py-4">
                <span className="font-mono text-xs uppercase tracking-wider text-honest">
                  Veritas
                </span>
                <span className="text-sm text-fg">
                  A third option: settle on{" "}
                  <span className="font-semibold">peer agreement</span> — provably,
                  with no judge at all.
                </span>
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </Section>
  );
}

function ProblemCard({
  badge,
  title,
  body,
  tone,
}: {
  badge: string;
  title: string;
  body: string;
  tone: "amber" | "slash";
}) {
  const color = tone === "amber" ? "text-amber" : "text-slash";
  return (
    <div className="h-full rounded-2xl border border-line bg-panel/40 p-6 transition-colors hover:border-line/90">
      <div className={`font-mono text-[10px] uppercase tracking-wider ${color}`}>
        {badge}
      </div>
      <h3 className="mt-3 text-lg font-semibold text-fg">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
