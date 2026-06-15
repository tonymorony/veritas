# Reputable-Worker floor + genesis Reference Workers (probation Sybil mitigation)

Every Round's Assignment must include a floor of ≥1–2 reputable Workers (standard-Tier or
protocol-run **Reference Workers**), so no Round — probation included — can be a pure-Sybil
majority. The threat is *majority capture*: a colluding Sybil majority in one Round can make a wrong
answer "surprisingly common," inverting CA to reward the Sybils and slash the honest minority. The
floor caps the Sybil-controllable fraction structurally.

Reference Workers are operator-run, known-honest agents used to satisfy the floor in probation and
at genesis (before any Agent has earned Reputation — which also solves the system's cold-start).
**They receive no special scoring weight**: CA scores them like any other Worker and they are
slashable. This is deliberate — it preserves trustlessness (they are not a privileged scorer; a
dishonest Reference Worker would itself be slashed) while still diluting Sybil influence.

## Considered options

- **Economics only** (per-identity min Stake + the low-EV argument, document capture as accepted
  risk) — cheaper to build, but leaves "no Round is majority-unproven" unguaranteed.
- **Identity/proof-of-personhood gating** — stronger, but heavy infra, out of scope for two weeks.

## Consequences

- Genesis bootstrap is solved: Reference Workers anchor the first Rounds.
- The swarm must always field enough reputable/Reference Workers to satisfy the floor across
  concurrent Rounds.
- Reference Workers must never be given scoring privilege, or the trustless property breaks — a
  guardrail for future contributors.
