import { Container, Section, Eyebrow, Reveal, RevealGroup, RevealItem } from "./primitives";

const stack = [
  {
    name: "Arc",
    role: "Settlement chain",
    desc: "Rounds, escrow, and payouts settle on-chain on Arc — verified live on testnet.",
  },
  {
    name: "Circle",
    role: "x402",
    desc: "Real x402 pay-per-request at the API boundary; USDC settlement, with Gateway nanopayments on the roadmap.",
  },
  {
    name: "ERC-8004",
    role: "Identity & reputation",
    desc: "Reputation that anchors the floor — written on-chain each Round.",
  },
  {
    name: "ERC-8183",
    role: "Escrow",
    desc: "On-chain escrow that locks Round funds and enforces the settlement math.",
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
              The live demo runs real LLM worker-agents behind a real x402 payment gate
              and settles on-chain on Arc — real USDC payouts, slashing, and reputation,
              verified live on Arc testnet.
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
