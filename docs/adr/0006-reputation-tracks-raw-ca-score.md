# Reputation is an EMA of the raw CA score, not the normalized payout score

Reputation (the per-Worker honesty record on ERC-8004) is computed as an EMA of each
Round's **raw** Correlated Agreement score (∈ [−1, 1]), not the `[0,1]` normalized score
used for payout. We chose raw because it keeps 0 as a meaningful neutral origin —
"no evidence either way / chance" — which is also where an unproven Agent starts, and
because it lets sustained dishonesty (negative raw) drag standing down rather than
clamping to the same floor as merely-uninformative work.

## Considered options

- **Normalized [0,1] score** — shares a scale with payout and stores cleanly on-chain, but
  collapses "actively anti-correlated" (negative raw) and "unproven / no signal" (raw 0)
  to the same value, so Reputation could not distinguish a colluder from a newcomer.

## Consequences

- Tier floors are expressed in raw-score space (e.g. probation has no floor; standard and
  premium sit at small positive raw thresholds — raw rarely approaches 1, see ADR-0004).
- Reputation can be **negative**; that is deliberate — a known-dishonest Agent has negative
  standing, not zero.
