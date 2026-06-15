# Swarm must span ≥3 model families (heterogeneity is a mechanism requirement)

The Swarm of Agents must be built from at least 3 genuinely distinct base model families, each
further varied by persona prompt — not personas/temperatures over a single model.

This is a correctness constraint, not a flavor choice. Correlated Agreement scores an answer by how
"surprisingly common" it is relative to peers' predictions. A single-model Swarm produces
near-identical answers, which degenerates the co-occurrence signal and is mathematically
indistinguishable from collusion — the honesty equilibrium loses its meaning. Genuine model
diversity is what makes "honest agreement" distinguishable from "everyone parroting the same model."

## Consequences

- Operational cost: 3+ model providers (API keys, spend) for the demo Swarm.
- A future contributor must not "simplify" the Swarm to one model — doing so silently breaks the
  mechanism's validity.
- Fallback if a provider is unavailable: distinct system-prompt personas over fewer models,
  explicitly noted as degrading signal diversity (and to be called out in the internal docs if used).
