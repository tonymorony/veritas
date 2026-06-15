# Guide: Run the live demo

This is a hands-on walkthrough of the Veritas demo dashboard — a self-contained simulation of the full [Round](/core-concepts#round) lifecycle. Every number you see is produced by the **real** `@x402-plays/core` mechanism (the same `scoreRound` / `settleRound` you'd call in production); only the swarm, the on-chain transactions, and the Circle rails are mocked. By the end you'll be able to read every region of the UI and run a healthy Round yourself.

> **Launch it:** start the demo and open it at [http://localhost:4173](http://localhost:4173). Keep this guide open beside it.

![The Veritas demo dashboard running a healthy Round — controls, the worker×task grid, the settlement ledger, the Circle feed, reputation, and the leaderboard.](/shots/dashboard-healthy.png)

## Step 1 — Set the Round parameters (controls)

The control panel configures the Round before you run it. The key knobs:

- **Tasks (N)** — how many Tasks the Round contains. More Tasks give CA a richer grid and steadier scores.
- **Round size (M)** — how many Workers are assigned. The [reputable-majority floor](/architecture#adr-0005) requires `⌊M/2⌋ + 1` reputable Workers.
- **Base reward** and **Stake** — the Tier economics: per-Report reward drawn from [Escrow](/core-concepts#escrow), and the [Stake](/core-concepts#stake) each Worker puts at risk.
- **Honest accuracy** — how often genuinely honest Workers land on the truth (they're skilled, not omniscient).
- **Sybil target / strategy** — which model a colluding cartel tries to boost, and how (naive vs. coordinated). Leave these for the [collusion guide](/guide-collusion); a healthy run barely needs them.
- **Enforce majority floor** — keep this **ON** for a healthy Round.
- **Seed** — the deterministic randomness source (models on-chain `prevrandao`). The same seed reproduces the same Round exactly.

Start with the defaults, floor **ON**.

## Step 2 — Run a Round

Trigger the Round. The protocol randomly [assigns](/core-concepts#assignment) M Workers from the eligible pool (honest Workers, [Reference Workers](/core-concepts#reference-worker), maybe a lazy one or a Sybil), runs [commit–reveal](/core-concepts#commit-reveal), checks [Quorum](/core-concepts#quorum), scores with [Correlated Agreement](/correlated-agreement), and settles. Run it a few times to warm up [Reputation](/core-concepts#reputation) across the swarm — Reputation is an EMA, so it sharpens over several Rounds.

## Step 3 — Read the worker×task grid

The grid is the Round itself: **one row per Worker, one column per Task**, each cell showing that Worker's revealed [answer](/core-concepts#report). This is the exact matrix CA scores. Look for the pattern:

- **Honest Workers and Reference Workers** show *task-correlated* answers — they tend to agree with each other *column by column*, because they're all reading the same content.
- A **lazy ("always-popular") Worker** shows the same answer down most of the column-independent cells — flat, content-blind agreement.

The grid is where you can *see* why CA pays some Workers and not others.

## Step 4 — Read the settlement ledger

The ledger is the output of `settleRound`: one row per Worker showing

- **raw** and **normalized** CA score,
- **reward** (`base_reward × normalized × #reports`) drawn from Escrow,
- **slash** (50% of Stake if raw ≤ 0 — below the [honesty threshold](/core-concepts#honesty-threshold)),
- **redistribution** (a share of slashed Stake, paid to honest Workers),
- **stake returned**.

In a healthy Round the honest and Reference Workers carry positive raw scores and full rewards; any lazy or random Worker sits near zero and gets slashed, with its Stake flowing to the honest ones. Confirm the **Requester refund** at the bottom — the Requester only pays for quality delivered — and that money is conserved.

## Step 5 — Watch the Circle feed

The Circle feed is the mocked payment rail (see the [primitive mapping](/architecture#adr-0003)). It shows the two distinct primitives in action:

- an **x402 Access payment** when the Round is posted (and when results are pulled),
- a stream of per-Report **Gateway nanopayments** at Settlement — one tiny on-chain transaction per Report, plus the Paymaster covering gas in USDC.

This is the "high-volume micro-settlement" story made visible.

## Step 6 — Read Reputation and the Leaderboard

- **Reputation** shows each Worker's running honesty record — the EMA of their **raw** CA scores ([ADR-0006](/architecture#adr-0006)). Reference and honest Workers climb into the standard/premium [Tiers](/core-concepts#tier); a Worker that keeps scoring sub-threshold drifts toward (and below) zero and loses eligibility.
- The **Leaderboard** is the productive artifact: a peer-validated ranking of the *models being evaluated*. In a healthy Round its **truth-match** is high — the peer ranking closely tracks the hidden ground-truth quality the protocol never sees. That's the whole point: useful, trustworthy eval data falls out of honest settlement.

## What you just saw

You ran a Round end to end and watched honest work get paid, lazy work get slashed, the Requester refunded for undelivered quality, and a trustworthy Leaderboard emerge — all with **no oracle**. Next, break it on purpose: [The collusion attack & the majority floor](/guide-collusion).
