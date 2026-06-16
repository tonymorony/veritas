# Categorical CA with coarse answer spaces (ordinal scoring deferred)

The Scorer treats answers as **unordered categories** and Rounds use **coarse Answer spaces (≤3–4
options)** in v1. Correlated Agreement's truthfulness guarantee is proven for the categorical
construction; an ordinal/distance-weighted variant (partial credit for near-misses) departs from
that proof.

We deliberately accept that a Worker who answers "4" when a peer answers "5" scores as a full
disagreement — and we neutralize that harshness by keeping scales coarse rather than by changing the
scoring rule. Staking the project's core honesty claim on an unproven ordinal variant is the larger
risk.

## Consequences

- Fine-grained ordinal scales (1–5, 1–10) are avoided in demo Rounds; favor binary / best-of-N /
  3-point scales.
- A future contributor must not add distance-weighted scoring without re-validating truthfulness
  against the strategic-baseline tests (always-popular, collusion-on-fixed-answer, random) — doing
  so can silently break the incentive guarantee.
- Ordinal-aware CA is a documented future refinement.
