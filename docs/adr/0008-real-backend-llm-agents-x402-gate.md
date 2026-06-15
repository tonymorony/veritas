# Real backend: LLM worker-agents + x402-gated API, with graceful fallback

To make the demo *functional* (real agents doing real work, not only a client-side
simulation), we add a backend service (`apps/server`) that runs Rounds through the real
`@x402-plays/core` and a real worker-agent layer (`packages/agents`). Worker agents call
live LLM providers (Anthropic / OpenAI / Google — satisfying the ADR-0002 heterogeneity
requirement) to produce their judgments; when no provider keys are configured the layer
falls back to the deterministic simulated swarm, so the demo always runs. The round/
leaderboard endpoints sit behind a real **x402** (HTTP-402) payment gate at the API
boundary (ADR-0003), with modes: `mock` (the **default** — a real 402 challenge/response that
the dashboard auto-pays, so the handshake is functional in the demo without a wallet), `off`
(open), and `live` (real x402-express + facilitator, requires a funded wallet).

## Consequences

- The frontend gains a "Live server" engine toggle; the in-browser simulation remains the
  default so the dashboard works with zero setup.
- Going fully live is a config step: drop provider keys (and, for settlement, a wallet) into
  `.env`. No code change required.
- On-chain Circle/Arc settlement (ERC-8004/8183, Gateway nanopayments) remains the next step
  beyond this; x402 at the boundary is the first real Circle-stack integration.
