# How Correlated Agreement works

Correlated Agreement (CA) is the heart of Veritas: a way to score subjective work **without an answer key** by measuring how Workers' answers agree across many Tasks. This page builds the intuition, walks a small example, and states the guarantees. It is grounded in [ADR-0004](/architecture#adr-0004).

## The core idea: score the *surprise*, not the *agreement*

Naively, you might pay Workers who agree with the crowd. That is a disaster: the easiest way to agree with the crowd is to **always answer the popular thing** — pick `A` on every Task, ignore the actual content. A pure "agree with the majority" rule would reward exactly that lazy or colluding behaviour.

CA fixes this by asking a sharper question. Not *"did you agree with your peer?"* but:

> **"Did you agree with your peer *more on the same Task* than you would have agreed by chance across different Tasks?"**

An honest Worker who actually reads Task #7 agrees with other honest Workers **specifically on Task #7** — their answers are *correlated through the shared content*. A Worker who just spams `A` agrees with everyone everywhere equally, on Task #7 no more than on Task #3. That flat, content-blind agreement is the **chance baseline**, and CA subtracts it out.

## The scoring rule

For each Worker `i`, CA computes:

```
raw_score(i)  =  (mean agreement with peers on the SAME Task)
              −  (mean agreement with peers on DIFFERENT Tasks)
```

- The first term rewards **task-correlated agreement** — answering the way honest peers answer *this specific Task*.
- The second term is the **chance-agreement baseline** — how much you'd agree just from both following the same blanket strategy.

"Agreement" is read off a signed matrix `S(a, b)` built empirically from the Round: `S(a, b) = 1` when answers `a` and `b` co-occur on the same Task **more often than their independent marginals predict**, and `0` otherwise. Nothing is assumed in advance — the matrix is *learned from the Round's own grid*. CA is prediction-free and prior-free.

The result is a **raw score in `[−1, 1]`**:

- **Positive** — genuine, content-driven agreement. Honest, high-effort work.
- **≈ 0** — answering the popular thing regardless of Task, or answering randomly. No better than chance.
- **Negative** — *anti*-correlated with the honest signal: worse than chance.

## Why truth-telling wins

The key property: **truthful, high-effort reporting is a strict equilibrium**. No matter what the other Workers do, your best response is to actually read the Task and report your real judgment. The shortcuts all fail:

| Strategy | What it does | CA outcome |
|---|---|---|
| **Honest** | Reads each Task, reports real judgment | Positive raw score — paid in full for quality |
| **Always-popular** | Picks the most common answer every time | ≈ 0 — same-Task and different-Task agreement cancel |
| **Random** | Answers at random | ≈ 0 — no task correlation to find |
| **Constant collusion** | A cartel all pre-agree to answer `A` | ≤ 0 — fully content-blind, scores at or below chance |

Constant collusion and random answering score **at or below zero** — and because the [honesty threshold](/core-concepts#honesty-threshold) sits at raw ≤ 0, those Workers earn nothing **and** get slashed.

## A small worked example

Three Workers answer three best-of-two Tasks. The answer space is `{A, B}`. The hidden truth is `A, B, A`.

| Worker | Task 1 | Task 2 | Task 3 | Behaviour |
|---|---|---|---|---|
| Honest-1 | A | B | A | reads the content |
| Honest-2 | A | B | A | reads the content |
| Spammer | A | A | A | always answers `A` |

- **Honest-1 vs Honest-2**: they agree on Task 1 (`A`), Task 2 (`B`), Task 3 (`A`) — agreement is **concentrated on shared Tasks**. Their cross-Task agreement is lower. Same-Task minus different-Task is clearly **positive**. Both are paid.
- **Spammer**: agrees with the honest Workers on Tasks 1 and 3 (`A`) but disagrees on Task 2. Critically, the Spammer agrees with `A`-answers *everywhere* — on different Tasks just as much as on the same Task. Same-Task agreement minus different-Task agreement collapses toward **zero**. The Spammer lands at or below the threshold: **no reward, slashed**.

The Spammer looked like a high-agreement Worker on the surface. CA sees that the agreement carries **no task-specific information** and refuses to pay for it.

## From raw score to money

The raw score drives both payout and standing:

- **Payout** uses the [normalized score](/core-concepts#normalized-score): `raw` mapped into `[0, 1]` (raw ≤ 0 → 0). Then `payout = base_reward × normalized_score`.
- **Slash**: any Worker with raw ≤ 0 forfeits 50% of [Stake](/core-concepts#stake), redistributed to the honest Workers.
- **[Reputation](/core-concepts#reputation)** EMAs the **raw** score (not the normalized one), so 0 stays a meaningful neutral origin and sustained dishonesty drags standing negative ([ADR-0006](/architecture#adr-0006)).

## The one assumption — and its guardrail

CA's guarantee assumes the honest signal is the *dominant* one in the Round. If a coordinated cartel forms a **majority** of a Round, they can make a wrong answer "surprisingly common" and **invert** CA — flipping it to reward the cartel and slash the honest minority. Veritas closes this with the [reputable-majority floor](/architecture#adr-0005): every Round is structurally guaranteed an honest majority. See it happen — and get prevented — in [the collusion attack guide](/guide-collusion).

## Why categorical, why coarse

CA's truthfulness is proven for the **categorical** construction — answers as unordered labels. An ordinal variant that gives partial credit for near-misses ("you said 4, peer said 5") departs from that proof. Veritas deliberately keeps answer spaces **coarse (≤3–4 options)** instead of changing the rule, so honest agreement stays strong and full-disagreement scoring stays fair. Ordinal-aware CA is a documented future refinement ([ADR-0004](/architecture#adr-0004)).
