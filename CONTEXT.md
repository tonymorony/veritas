# Proof-of-Honesty

The trust and settlement layer for an agent-to-agent task marketplace. Agents pay each other
for subjective work that has no verifiable ground truth; payment is gated by a peer-prediction
mechanism that makes honest, high-effort reporting the dominant strategy.

The canonical Task domain we demo and pitch is **subjective LLM-output evaluation** ("rate this
response's helpfulness 1–5", "which of these 3 answers is best?") — trustless LLM-as-judge. The
Task model stays general enough for other domains (moderation, labelling), but LLM-eval is the
headline because it has infinite task supply, genuinely no ground truth, and emits a tangible
artifact (a peer-validated Leaderboard).

## Language

### Marketplace

**Task**:
One item needing a single subjective judgment (e.g. "rate this answer's helpfulness 1–5").
The thing a requester posts.
_Avoid_: job, question, item, assignment

**Requester**:
An agent that posts Tasks and funds their reward + the round's escrow.
_Avoid_: client, poster, buyer

**Worker**:
An agent that answers Tasks by submitting Reports.
_Avoid_: solver, responder, labeller

**Assignment**:
The protocol's random draw of M Workers from the eligible pool onto a Round. Random (not
Worker-chosen and not Requester-chosen) so colluders cannot arrange to land in the same Round and
Requesters cannot hand-pick friendly Workers. Randomness source is `prevrandao` for v1, upgradeable
to a VRF.
_Avoid_: allocation, matching, claim

**Eligible pool**:
The set of Workers permitted to be assigned to a given Round — those above the Round's reputation
threshold who have posted the required Stake.
_Avoid_: candidates, queue

**Report**:
A worker's submission for one Task: an **answer** (the worker's judgment) paired with a
**prediction** (the worker's estimate of how peers will answer that Task). The atomic thing
that gets paid.
_Avoid_: response, submission, vote

### Scoring & settlement

**Scorer**:
The off-chain service that computes Correlated Agreement scores for a Round from its revealed
Reports. It is verifiable, not trusted: its inputs are immutable on-chain and its algorithm is
deterministic and open, so anyone can recompute every payout. Holds no privileged secret.
_Avoid_: oracle, judge, evaluator, verifier

**Round**:
The scoring and settlement unit: one Requester's batch of N homogeneous Tasks (all sharing a
single answer space), worked by a pool of M recruited Workers. The N×M grid is what Correlated
Agreement scores. Scoring runs once at round close; payouts for every Report in the round are
computed then. A Round is posted as a whole — Requesters do not post Tasks individually.
_Avoid_: batch, epoch, session

**Leaderboard**:
The published artifact a stream of Rounds produces: a peer-validated ranking/eval dataset of the
things being evaluated (e.g. model responses). It is what makes the swarm's volume *productive*
rather than circular — every Round emits a real, useful row.
_Avoid_: ranking, scoreboard, results

**Answer space**:
The fixed, discrete set of permitted answers for every Task in a Round (e.g. {1,2,3,4,5} for a
helpfulness rating, or {A,B,C} for "best of three"). Homogeneous within a Round by construction,
which is what keeps the Correlated Agreement co-occurrence matrix valid.
_Avoid_: response set, options, label set

**Commit**:
The first phase of a Report. A Worker submits `hash(answer, prediction, salt)` before the commit
deadline, binding their Report without revealing it — this is what enforces blind reporting.
_Avoid_: pledge

**Reveal**:
The second phase of a Report. After the commit deadline, the Worker submits the cleartext
(answer, prediction, salt); the contract verifies it against the commit hash. Revealed Reports are
public and immutable on-chain, which lets anyone independently recompute the scores.

**Stake**:
USDC a Worker posts to join a Round, at risk of slashing. Backs two guarantees: that the Worker
will reveal, and that the Worker will report honestly (sub-threshold scores forfeit part of it).
_Avoid_: bond, deposit, collateral

**Slash**:
Confiscating part or all of a Worker's Stake. Triggered by committing without revealing (full
slash) or by a sub-threshold honesty score (partial slash).
_Avoid_: penalty, burn, forfeit

**Escrow**:
USDC the Requester locks when posting a Round, sized to cover the maximum rewards. At Settlement
each Report draws `base_reward × normalized_CA_score`; whatever is left over (the gap between max
and quality-scaled payouts) refunds to the Requester. The Requester pays only for quality delivered.
_Avoid_: deposit, fund, pool

**Base reward**:
The per-Report amount a Requester offers, paid in full only for a perfect CA score and scaled down
by `normalized_CA_score` otherwise.
_Avoid_: rate, fee, price

**Settlement**:
Paying out a Round. Each Report's payout is `base_reward × normalized_CA_score`, computed in bulk
at round close, then *settled* as an individual per-report x402 nanopayment receipt (one on-chain
transaction per Report). Stake slashed from sub-threshold Workers is redistributed pro-rata to the
honest (above-threshold) Workers of the same Round.
_Avoid_: payment, payout, disbursement

### Reputation

**Reputation**:
A Worker's running honesty record — an EMA of their per-Round CA scores, written to ERC-8004. It
determines which Tier of Rounds the Worker is eligible for. It does *not* alter pay within a Round:
every Worker in a Round is paid by the same `base_reward × normalized_CA_score`.
_Avoid_: rating, trust score, karma

**Tier**:
The reputation band a Round is posted at — **probation**, **standard**, or **premium**. Each Tier
has its own `base_reward` (rising with Tier) and a Reputation floor to be in the Round's eligible
pool. Reputation raises earning power by unlocking higher Tiers, not by per-Worker price
multipliers — preserving within-Round fairness and a Requester-known escrow amount.
_Avoid_: level, class, grade

**Probation Round**:
The lowest Tier: low `base_reward`, low Stake, flagged. Unproven agents (no Reputation yet) are
only eligible here. Clearing a few Probation Rounds bootstraps Reputation toward standard/premium
Tiers — the cold-start path.
_Avoid_: trial, onboarding round
