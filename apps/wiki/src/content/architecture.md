# Architecture

Veritas is built around one atomic unit — the **[Round](/core-concepts#round)** — and a settlement flow that is *verifiable rather than trusted*. This page walks the round lifecycle, explains the off-chain scoring decision, maps the Circle / Arc primitives, and summarizes the key architectural decisions (ADRs).

## The round lifecycle

A Round moves through seven stages from posting to standing:

1. **Post** — a [Requester](/core-concepts#requester) posts a batch of N homogeneous [Tasks](/core-concepts#task) at a chosen [Tier](/core-concepts#tier), and locks [Escrow](/core-concepts#escrow) sized to the maximum payout (`base_reward × N × M`). Posting is gated by an x402 [Access payment](/core-concepts#settlement).
2. **Assign** — the protocol randomly draws M [Workers](/core-concepts#worker) from the eligible pool, guaranteeing a [reputable majority](#adr-0005). Random draw means colluders can't pick their Round and Requesters can't pick their Workers.
3. **Commit** — each assigned Worker submits `hash(answer, salt)` on-chain before the commit deadline, binding their answers blind.
4. **Reveal** — after the deadline, Workers submit cleartext `(answer, salt)`; the contract verifies each against its commit hash. Revealed [Reports](/core-concepts#report) are now public and immutable.
5. **Score (off-chain)** — once the Round closes and clears [Quorum](/core-concepts#quorum), the [Scorer](/core-concepts#scorer) computes [Correlated Agreement](/correlated-agreement) over the worker×task grid, producing a raw and normalized score per Worker.
6. **Settle** — each Report's payout (`base_reward × normalized_score`) is paid as a per-Report Circle Gateway nanopayment; sub-threshold Workers are slashed and their Stake is redistributed to honest Workers; leftover Escrow refunds to the Requester. A [Leaderboard](/core-concepts#leaderboard) row is emitted.
7. **Reputation** — each participating Worker's [Reputation](/core-concepts#reputation) is EMA-updated from its raw score, which may move it across Tier floors for future Rounds.

If the Round fails Quorum at close it is **voided**: full Escrow refund, Stakes returned, no slash, no Reputation change, no Leaderboard row.

## Why off-chain scoring is verifiable, not trusted {#adr-0001}

> **ADR-0001 — Round-batched, off-chain-scored settlement with on-chain commit–reveal.**

CA cannot score a Report in isolation; it needs a grid of multiple Workers answering multiple shared Tasks. So the **Round** is the atomic scoring and settlement unit, not the individual Task. Within a Round, Workers report via on-chain **commit–reveal** so reporting is blind and the revealed Reports become public, immutable scoring inputs.

CA itself runs in an **off-chain Scorer** — fixed-point matrix math in Solidity under gas limits was judged too risky for a v1. The critical property is that this does **not** reintroduce a trusted third party:

- All scoring **inputs are on-chain** (the revealed Reports).
- The algorithm is **deterministic and open**.
- Therefore **anyone can recompute every payout** and challenge a wrong one.

An optimistic-challenge path (operator bond + recompute-and-slash) is specified but stubbed for v1; verifiability rests on the on-chain inputs plus the open algorithm. The trade-off: settlement is batch-triggered at round close rather than instant-on-submit, and commit + reveal means two transactions per Worker per Round.

## Swarm heterogeneity {#adr-0002}

> **ADR-0002 — Swarm heterogeneity requirement.**

CA needs *genuinely diverse honest signals*. If every Worker is the same base model under different prompts, their answers correlate for reasons that have nothing to do with reading the Task — a monoculture is statistically indistinguishable from collusion. The [Swarm](/core-concepts#swarm) must therefore span **at least three distinct base model families**, not persona or temperature variants of one model.

## Circle / Arc primitive mapping {#adr-0003}

> **ADR-0003 — x402 at the API boundary, nanopayments for Settlement.**

"x402 nanopayments" actually names two different primitives. Veritas separates them by surface:

| Primitive | Role in Veritas |
|---|---|
| **x402** (HTTP-402 pay-per-request) | The **API / MCP boundary** — what an Agent pays to *post a Round* or *pull Leaderboard results*. Matches x402's "pay to use a service" shape. |
| **Gateway nanopayments** | **Settlement** — per-Report escrow→Worker payouts settle as sub-cent nanopayments, one on-chain transaction per Report. The source of the high-volume micro-settlement count. |
| **Paymaster** | **Gasless UX** — gas-in-USDC, so a reviewer can run the full loop without holding native gas. |
| **ERC-8004** | **Agent identity + Reputation registry.** |
| **ERC-8183-style** | **Round Escrow.** |

Veritas explicitly rejects the reading where x402 itself disburses Worker payouts — that would overload a request-time protocol with contract-time settlement. (This ADR fixes the conceptual placement; exact integration interfaces are confirmed against the real libraries.)

## Categorical CA and coarse answer spaces {#adr-0004}

> **ADR-0004 — Categorical CA with coarse answer spaces (ordinal scoring deferred).**

The Scorer treats answers as **unordered categories** and Rounds use **coarse answer spaces (≤3–4 options)**. CA's truthfulness guarantee is proven for the categorical construction; a distance-weighted ordinal variant (partial credit for near-misses) departs from that proof. Veritas accepts that "4 vs 5" scores as a full disagreement and neutralizes the harshness by keeping scales coarse — rather than staking the core honesty claim on an unproven ordinal rule. Full intuition: [How Correlated Agreement works](/correlated-agreement).

## The reputable-majority floor {#adr-0005}

> **ADR-0005 — Reputable-Worker majority floor + genesis Reference Workers.**

This is the decision that makes the whole mechanism safe against collusion. Every Round's [Assignment](/core-concepts#assignment) must include a **majority** of reputable Workers — `⌊M/2⌋ + 1` of the M assigned, drawn from standard/premium-Tier Agents or protocol-run [Reference Workers](/core-concepts#reference-worker).

The threat is **majority capture**: a colluding Sybil majority in a single Round can make a wrong answer "surprisingly common," *inverting* CA so it rewards the Sybils and slashes the honest minority. Guaranteeing a reputable majority means the "surprisingly common" baseline is always anchored by honest Workers, so **CA cannot be inverted** — not merely made more expensive to attack. This makes "Sybils are always a minority in every Round" a *structural invariant*.

**Reference Workers** satisfy the floor during probation and at genesis (before any Agent has Reputation — which also solves cold-start). They get **no special scoring weight**: CA scores them like any other Worker and they are slashable. That is deliberate — it preserves trustlessness (a dishonest Reference Worker would itself be slashed) while still anchoring the honest majority. The floor self-adjusts by Tier: premium pools are already all-reputable, so the floor does its real work in probation, exactly where the pool is most Sybil-prone.

See the floor stop an attack in real time: [The collusion attack & the majority floor](/guide-collusion).

## Reputation tracks the raw CA score {#adr-0006}

> **ADR-0006 — Reputation is an EMA of the raw CA score, not the normalized payout score.**

Reputation EMAs each Round's **raw** CA score (∈ [−1, 1]), not the `[0, 1]` normalized payout score. Raw keeps **0 as a meaningful neutral origin** — "no evidence / chance" — which is where an unproven Agent starts, and it lets sustained dishonesty (negative raw) drag standing *below* zero rather than clamping a colluder to the same floor as merely-uninformative work. Tier floors are therefore expressed in raw-score space (probation floor 0; standard and premium at small positive thresholds, since raw rarely approaches 1).

## Orphaned slashed stake goes to the treasury {#adr-0007}

> **ADR-0007 — Orphaned slashed Stake goes to the protocol treasury, never the Requester.**

When a Round meets Quorum but *every* Worker scores sub-threshold (e.g. an all-collude Round), the forfeited Stake has no honest Worker to receive it. That orphaned Stake goes to a **protocol treasury** bucket — never to the Requester. Gifting it to the Requester (who did no honest work and can't be a Worker in their own Round) would create a perverse incentive to post Rounds hoping they collapse. The Requester's own Escrow still refunds in full; only the colluders' forfeited Stake is withheld. Money conservation holds:

```
escrow + Σstake = Σreward + ΣstakeReturned + Σredistribution + requesterRefund + treasury
```

## The real backend and the x402 gate {#adr-0008}

> **ADR-0008 — Real backend: LLM worker-agents + x402-gated API, with graceful fallback.**

The lifecycle above runs two ways. The dashboard's default is an **in-browser simulation**, but Veritas also ships a **real backend** (`apps/server`) that runs the *same* `@x402-plays/core` mechanism in memory and serves it over HTTP. Its `POST /api/round` and `GET /api/leaderboard` endpoints sit behind a real **x402** payment gate at the API boundary ([ADR-0003](#adr-0003)) — `mock` mode performs a genuine HTTP-402 challenge/response the dashboard auto-pays, and `live` mode verifies payments against a facilitator. The worker-agent layer can draw honest/Reference judgments from **real LLMs** across Anthropic, OpenAI, and Google ([ADR-0002 heterogeneity](#adr-0002)), falling back to the simulated swarm when no keys are present.

This is the first real Circle-stack integration (x402 at the boundary). Full reference: [Backend & API](/backend). Hands-on: [Run it live](/guide-live).

## The on-chain settlement layer {#adr-0009}

> **ADR-0009 — On-chain settlement layer: real escrow + reputation contracts, off-chain scoring.**

Beyond the x402 *access* gate, Veritas ships a Solidity settlement layer (`contracts/`, Foundry) that makes the [Settlement](/core-concepts#settlement) itself real: **MockUSDC** (a USDC stand-in locally, the canonical token on testnet), a **ReputationRegistry** (ERC-8004-style), and a **TaskEscrow** (ERC-8183-style) that runs `openRound → joinAndCommit → reveal → settle` (or `void` below Quorum). The escrow enforces — and reverts on any violation of — the exact `settlement.ts` math: per-Report payout, 50%/100% slash, equal-share redistribution to honest Workers, orphaned-slash-to-treasury ([ADR-0007](#adr-0007)), Requester refund, and full USDC conservation. Scoring stays off-chain ([ADR-0001](#adr-0001)); only the finished `RoundResult` is submitted, so the chain is the settlement *checker*, not the re-scorer.

The backend wires this through a `ChainSettler` seam with `CHAIN_MODE=off|local|testnet`: `local` auto-deploys to a local **anvil** and replays each Round as real transactions (the dashboard shows real tx hashes and an `on-chain · <chainId>` chip), and `testnet` is the same code pointed at Arc with a funded key — config, not a code change. This is **verified live on Arc testnet (chainId 5042002)**: a 5-Worker Round settled in one real `settle` transaction, moving USDC and writing a new on-chain Reputation. Full reference: [On-chain settlement](/onchain).
