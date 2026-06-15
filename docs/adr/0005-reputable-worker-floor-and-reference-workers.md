# Reputable-Worker majority floor + genesis Reference Workers (Sybil-capture mitigation)

Every Round's Assignment must include a **majority** of reputable Workers — `⌊M/2⌋ + 1` of
the M assigned, drawn from standard/premium-Tier Agents or protocol-run **Reference
Workers**. This makes "Sybils are always a minority in every Round" a *structural
invariant*, probation included. The threat is *majority capture*: a colluding Sybil
majority in one Round can make a wrong answer "surprisingly common," inverting CA to reward
the Sybils and slash the honest minority. Guaranteeing a reputable majority means the
"surprisingly common" baseline is always anchored by honest Workers, so CA cannot be
inverted — not merely made more expensive to attack.

Reference Workers are operator-run, known-honest agents used to satisfy the floor in
probation and at genesis (before any Agent has earned Reputation — which also solves the
system's cold-start). **They receive no special scoring weight**: CA scores them like any
other Worker and they are slashable. This is deliberate — it preserves trustlessness (they
are not a privileged scorer; a dishonest Reference Worker would itself be slashed) while
still anchoring the honest majority.

The floor self-adjusts by Tier: in **premium** Rounds the eligible pool is already all
reputable, so the floor is satisfied automatically; the floor does real work mainly in
**probation**, exactly where the pool is most Sybil-prone.

## Considered options

- **Fixed small floor (≥1–2 reputable)** — cheaper (fewer Reference Workers per Round, faster
  probation onboarding), but only *caps the Sybil-controllable fraction*; a Sybil majority
  (e.g. 3 of 5) remains possible, so majority capture is made costlier, not prevented. We
  rejected this because it doesn't deliver the structural guarantee the threat model demands.
- **Economics only** (per-identity min Stake + the low-EV argument) — cheaper still, but
  leaves "no Round is a Sybil majority" unguaranteed.
- **Identity/proof-of-personhood gating** — stronger, but heavy infra, out of scope for two weeks.

## Consequences

- Genesis bootstrap is solved: Reference Workers anchor the first Rounds' honest majority.
- The swarm must field enough reputable/Reference Workers to fill a majority of *every*
  concurrent Round — a higher operator cost than a fixed small floor.
- Probation onboarding is throttled: unproven newcomers get only the minority of slots per
  Round, a deliberate safety-for-throughput trade.
- Reference Workers must never be given scoring privilege, or the trustless property breaks —
  a guardrail for future contributors.
