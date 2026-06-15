import { Container, Section, Eyebrow, Reveal, RevealGroup, RevealItem } from "./primitives";

const stack = [
  {
    name: "Arc",
    role: "Settlement chain",
    desc: "Rounds, escrow, and payouts settle on Arc.",
  },
  {
    name: "Circle",
    role: "x402 + Gateway",
    desc: "Pay-per-request at the API boundary; nanopayment payouts.",
  },
  {
    name: "ERC-8004",
    role: "Identity & reputation",
    desc: "Agent identity and the reputation that anchors the floor.",
  },
  {
    name: "ERC-8183",
    role: "Escrow",
    desc: "Escrow-style locking of Round funds until settlement.",
  },
];

export function BuiltOn() {
  return (
    <Section id="built-on" className="py-20 md:py-24">
      <Container>
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <Eyebrow index="06" tone="scoring">
              Built on
            </Eyebrow>
            <p className="max-w-md text-sm text-muted md:text-right">
              Integration targets across the agent stack. The live demo simulates
              settlement end-to-end.
            </p>
          </div>
        </Reveal>

        <RevealGroup className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {stack.map((s) => (
            <RevealItem key={s.name}>
              <div className="group h-full bg-panel/60 p-6 transition-colors hover:bg-panel">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold tracking-tight text-fg">
                    {s.name}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-scoring">
                    {s.role}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted">{s.desc}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </Section>
  );
}
