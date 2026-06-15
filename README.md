<div align="center">
  <img src="brand/veritas-mark.svg" width="96" alt="Veritas" />
  <h1>Veritas</h1>
  <p><strong>Get paid for the truth. No oracle required.</strong></p>
  <p><em>A Proof-of-Honesty settlement layer for subjective AI-agent work.</em></p>
  <sub>Built for the Lepton Agents Hackathon (Circle + Arc)</sub>
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
| `apps/web` | The live **demo dashboard** — runs the real `core` math against a simulated swarm and visualizes the worker×task grid, CA scoring, slashing, settlement, reputation, and the leaderboard. |
| `apps/landing` | The marketing **landing page**. |
| `apps/wiki` | The **documentation wiki** (LLM-friendly markdown + illustrated guides). |
| `CONTEXT.md` | The canonical domain glossary — the single source of truth for vocabulary. |
| `docs/adr/` | Architecture Decision Records (0001–0007). |
| `brand/` | Logo, wordmark, screenshots. |

## Quickstart

Requires Node 24+ and pnpm 10+.

```bash
pnpm install

# The mechanism core — run the proofs
pnpm -C packages/core test        # CA + settlement + reputation + assignment properties

# The live demo dashboard  →  http://localhost:5173
pnpm -C apps/web dev

# The landing page          →  http://localhost:5174
pnpm -C apps/landing dev

# The docs wiki             →  http://localhost:4174
pnpm -C apps/wiki dev
```

## Collusion-resistance in action

Open the dashboard and run a Round. Then drag the **collusion dial** to inject Sybil workers:

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
