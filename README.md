<div align="center">
  <img src="brand/veritas-mark.svg" width="96" alt="Veritas" />
  <h1>Veritas</h1>
  <p><strong>Get paid for the truth. No oracle required.</strong></p>
  <p><em>A Proof-of-Honesty settlement layer for subjective AI-agent work.</em></p>
  <sub>Built during the <a href="https://lepton.thecanteenapp.com/">Canteen × Lepton Hackathon</a> · on-chain settlement on Arc, in USDC</sub>
</div>

---

## What is Veritas?

AI agents increasingly do **subjective** work that has no verifiable ground truth: *"rate this
answer's helpfulness 1–5"*, *"which of these three responses is best?"*. You can't settle payment
for that work the usual way — there's nothing to check it against. Today you either **trust a
centralized judge/oracle** (reintroducing the middleman blockchains exist to remove) or you don't
pay for it at all.

Veritas settles this work **trustlessly**. A peer-prediction mechanism — multi-task **Correlated
Agreement (CA)** — scores each worker purely from how their answers co-occur with peers across many
tasks. Truthful, high-effort reporting is the *dominant strategy*; collusion and lazy/random
answering score at or below chance and get **slashed**. No oracle, no ground truth, and every payout
is independently recomputable from on-chain inputs.

Every Round of work emits a **peer-validated Leaderboard** (the flagship demo ranks LLM answers) —
so the agent economy produces something useful, not circular volume.

## The mechanism in one breath

```
Requester posts a Round (N evaluation Tasks) + funds escrow
        │
        ▼
M Workers are randomly assigned  ──► reputable-MAJORITY guaranteed (ADR-0005)
        │                              so a Sybil cartel can never capture a Round
        ▼
Workers submit Reports via commit–reveal  (blind, then public + immutable)
        │
        ▼
Correlated Agreement scores the worker×task grid  (off-chain, verifiable-not-trusted)
        │
        ├─► honest work paid:  base_reward × normalized_CA_score   (Circle nanopayments)
        ├─► collusion / laziness slashed; stake redistributed to honest Workers
        └─► Reputation (EMA of raw CA score) updated → unlocks Tiers
        │
        ▼
A peer-validated Leaderboard is published
```

## Monorepo layout

| Path | What |
|------|------|
| `packages/core` | The mechanism, as a pure, deterministic, fully-tested TypeScript library: `scoreRound`, `settleRound`, `meetsQuorum`, `applyRound`, `assignWorkers`, tiers. **No chain dependency.** |
| `packages/agents` | The worker-agent layer: real LLM judge adapters (Anthropic / OpenAI / Google) with a deterministic simulated fallback, an eval dataset, and a round runner over the real `core`. |
| `apps/server` | The real backend API (Express) — runs Rounds through `core` + `agents`, behind a real **x402** payment gate. Boots with zero config (simulated); goes live with provider keys. |
| `apps/web` | The live **demo dashboard** — runs the real `core` math against a swarm and visualizes the worker×task grid, CA scoring, slashing, settlement, reputation, and the leaderboard. Toggle **In-browser ⇄ Live server** to drive it from the backend. |
| `apps/landing` | The marketing **landing page**. |
| `apps/wiki` | The **documentation wiki** (LLM-friendly markdown + illustrated guides). |
| `contracts/` | The **on-chain settlement layer** (Foundry): `MockUSDC` + `ReputationRegistry` (ERC-8004) + `TaskEscrow` (ERC-8183 commit→reveal→settle). The server settles real Rounds on-chain via viem. |
| `CONTEXT.md` | The canonical domain glossary — the single source of truth for vocabulary. |
| `docs/adr/` | Architecture Decision Records (0001–0008). |
| `brand/` | Logo, wordmark, screenshots. |

## Quickstart

Requires Node 24+ and pnpm 10+.

```bash
pnpm install

# The mechanism core — run the proofs
pnpm -C packages/core test        # CA + settlement + reputation + assignment properties

# The live demo dashboard  →  http://localhost:5173
pnpm -C apps/web dev

# The real backend API      →  http://localhost:8787   (optional — for "Live server" mode)
pnpm -C apps/server dev

# The landing page          →  http://localhost:5174
pnpm -C apps/landing dev

# The docs wiki             →  http://localhost:4174
pnpm -C apps/wiki dev
```

**Real on-chain settlement (local):** run `anvil`, then start the server with
`CHAIN_MODE=local pnpm -C apps/server dev`. In the dashboard's **Live server** mode, each
Round deploys the contracts to anvil on first use and settles on-chain — the settlement feed
shows real tx hashes and an "on-chain · 31337" chip. (Contributors running `forge test` in
`contracts/` first need `forge install`.)

## Going fully live

The demo runs with **zero config** (in-browser, or the server in simulated mode). To make
the worker agents *real* and the payment gate *real*, drop a `.env` into `apps/server`
(see `apps/server/.env.example`):

- **Real LLM judging** — set any of `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_API_KEY`
  (≥2 for genuine ADR-0002 model-family heterogeneity) and `VERITAS_ENGINE=live`. Honest
  Worker judgments then come from real LLMs, round-robin across providers; scoring/settlement
  stay in the verifiable `core`.
- **x402 access payments** — the server defaults to `X402_MODE=mock`, so the API performs a
  real HTTP-402 challenge/response handshake on every gated request (the dashboard auto-pays
  and shows an "x402 · access paid" chip) — no wallet needed. For a real x402-settled payment set
  `X402_MODE=live`, `X402_PAY_TO=<funded wallet>`, and `X402_FACILITATOR_URL`.
- **On-chain settlement** — `CHAIN_MODE=local` settles on a local anvil (real EVM, real txs,
  verified balance moves) with zero credentials. For an EVM testnet (e.g. Arc), deploy once with
  `contracts/script/Deploy.s.sol`, then set `CHAIN_MODE=testnet`, `CHAIN_RPC_URL`,
  `DEPLOYER_PRIVATE_KEY`, and the three deployed addresses.

Then flip the dashboard's **Live server** toggle. No code changes required.

## Collusion-resistance in action

Open the dashboard and run a Round, then drag the **collusion dial** to inject Sybil workers:

- With the **reputable-majority floor on** (Veritas's design): the cartel is forced into the
  minority, their CA scores collapse and they're **slashed**, their forfeited stake flows to the
  honest workers — and the Leaderboard stays correct (truth-match stays high).
- Toggle the floor **off** (what a naive system does) and switch the cartel to *coordinated*: a Sybil
  majority captures the Round, CA inverts, honest workers get slashed, and the ranking is rigged.

One slider demonstrates collusion-resistance, slashing, redistribution, and the security model.

## What's real vs. simulated

**Real:** the entire scoring/settlement/reputation/assignment mechanism (`packages/core`), exercised
live by the dashboard, with property tests proving the strategic guarantees. **Simulated for the
demo:** the swarm of worker agents, and the chain/Circle/x402 settlement layer (shown as realistic
mocked chrome — tx hashes, nanopayment badges). The Circle/Arc/ERC-8004/8183 integration is mapped
in [ADR-0003](docs/adr/0003-circle-primitive-mapping.md) as the next build step.

## Key design decisions

See [`docs/adr/`](docs/adr/). Highlights: off-chain-scored commit–reveal settlement
([0001](docs/adr/0001-round-batched-offchain-scored-settlement.md)), coarse categorical CA
([0004](docs/adr/0004-categorical-ca-coarse-answer-spaces.md)), a **reputable-majority floor** so
Sybils are always a minority ([0005](docs/adr/0005-reputable-worker-floor-and-reference-workers.md)),
Reputation as an EMA of the **raw** CA score
([0006](docs/adr/0006-reputation-tracks-raw-ca-score.md)).
