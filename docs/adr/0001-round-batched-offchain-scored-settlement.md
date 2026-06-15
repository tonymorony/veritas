# Round-batched, off-chain-scored settlement with on-chain commit–reveal

Proof-of-Honesty gates payment on a Correlated Agreement (CA) peer-prediction score, which cannot
score a Report in isolation — it needs a grid of multiple Workers answering multiple shared Tasks.
We therefore make the **Round** (one Requester's homogeneous batch of N Tasks worked by M Workers)
the atomic scoring and settlement unit, rather than settling each Task independently as a live
marketplace would.

Within a Round, Workers report via **on-chain commit–reveal** so that reporting is blind (seeing a
peer's answer first would collapse the honesty equilibrium) and so that the revealed Reports become
public, immutable scoring inputs.

CA is computed by an **off-chain Scorer**, not on-chain. Because all inputs are on-chain and the
algorithm is deterministic and open, the Scorer is *verifiable, not trusted*: anyone can recompute
every payout. Settlement still fans out as per-Report x402 nanopayments.

## Considered options

- **On-chain CA computation** — maximally trustless, but fixed-point matrix math in Solidity under
  gas limits was judged too risky for a v1.
- **Trusted off-chain operator** — simplest, but reinstates the trusted third party the project
  exists to remove.
- **Live per-Task marketplace** — better UX, but no peer grid means no valid CA score.

## Consequences

- Settlement is batch-triggered at round close, not instant-on-submit.
- An **optimistic challenge** path (operator bond + recompute-and-slash) is specified but
  **stubbed for v1**; verifiability rests on on-chain inputs + open algorithm.
- Commit + reveal = two txns per Worker per Round — extra cost, but also extra
  semantically-meaningful on-chain volume.
