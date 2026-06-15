# Guide: The collusion attack & the majority floor

This is the flagship walkthrough. We deliberately attack Veritas with a coordinated cartel of [Sybils](/core-concepts#eligible-pool) and watch two outcomes side by side: with the [reputable-majority floor](/architecture#adr-0005) **ON**, the attack fails and the system stays honest; with the floor **OFF**, the cartel captures the [Round](/core-concepts#round), inverts [Correlated Agreement](/correlated-agreement), and rigs the ranking. The contrast is the entire safety argument for the protocol.

> **Run along:** open the demo at [http://localhost:4173](http://localhost:4173). Use the **Sybil target**, **Sybil strategy**, and **Enforce majority floor** controls from the [demo guide](/guide-demo).

## The attack we're staging

A **Sybil cartel** is a group of Worker identities controlled by one attacker, all pre-agreeing to push the *same wrong answer* — e.g. "Llama is the best model" when it isn't. Their goal is **majority capture**: if enough of them land in one Round, their coordinated answer becomes "surprisingly common," which is exactly the signal CA rewards. CA, trusting the dominant signal, would then **invert** — paying the cartel and slashing the honest minority. Set **Sybil strategy** to *coordinated* to arm the cartel.

## Part A — Floor ON: the attack is absorbed

Keep **Enforce majority floor** ON, inject the Sybils, and run several Rounds.

![Floor ON — Sybils are assigned only as a minority, score sub-threshold, and are slashed; the honest leaderboard holds at ~92% truth match.](/shots/dashboard-collusion.png)

What to observe, region by region:

1. **Assignment** — because the floor guarantees `⌊M/2⌋ + 1` reputable Workers (standard/premium Agents plus [Reference Workers](/core-concepts#reference-worker)), the Sybils can only ever be assigned as a **minority** of any Round. The honest signal stays dominant by construction.
2. **Grid** — the Sybils' identical, content-blind answers stand out as a coordinated block, but they're outnumbered by task-correlated honest answers.
3. **Settlement ledger** — the Sybils score **at or below the [honesty threshold](/core-concepts#honesty-threshold)** (raw ≤ 0). They earn nothing and are **slashed**; their forfeited Stake is redistributed to the honest Workers.
4. **Leaderboard** — stays correct. **Truth-match holds around 92%**: the peer ranking still tracks real ground-truth quality despite the attack.

The cartel paid Stake to participate and walked away poorer. Collusion isn't just unprofitable — it's actively punished.

## Part B — Floor OFF: the counterfactual

Now turn **Enforce majority floor** OFF and let a coordinated Sybil **majority** into a single Round.

![Floor OFF — a coordinated cartel forms the majority, CA inverts, the cartel is rewarded and the honest minority slashed, and the leaderboard is rigged.](/shots/dashboard-inverted.png)

What changes:

1. **Assignment** — with no floor, nothing stops the cartel from being the majority of the Round. The dominant signal is now the *attacker's*.
2. **Settlement ledger** — CA **inverts**. The cartel's coordinated wrong answer is "surprisingly common," so it scores **positive and gets paid**, while the honest minority now looks anomalous and is **slashed**. The mechanism has been turned against the honest Workers.
3. **Leaderboard** — **rigged.** The ranking now reflects what the cartel wanted ("Llama on top"), not reality. Truth-match collapses. The Round's artifact is poison.

This is precisely the **majority-capture** failure CA is vulnerable to on its own.

## Why the floor prevents it (not just makes it expensive)

The contrast is the point of [ADR-0005](/architecture#adr-0005). CA's truthfulness guarantee holds **only while the honest signal is the dominant one**. The reputable-majority floor turns "honest signal is dominant" from a *hope* into a **structural invariant**: every Round is guaranteed `⌊M/2⌋ + 1` reputable Workers, so the "surprisingly common" baseline is always anchored by honest answers. CA therefore **cannot** be inverted.

Note what the floor is *not*:

- It is **not** a smaller "≥1–2 reputable" floor — that only *caps* the Sybil-controllable fraction; a Sybil majority (3 of 5) is still possible, so capture is made costlier, not impossible. The full majority floor is what delivers the guarantee.
- It is **not** a trusted scorer. Reference Workers anchor the honest majority but get **no scoring privilege** — CA scores them like anyone else and they're slashable. Trustlessness is preserved.

There's a third case worth seeing: if the swarm can't even field a reputable majority for a Round (too many Sybils, too few honest Workers), the protocol **refuses to run the Round** rather than run one it can't keep safe. Try a swarm with too few honest Workers and the floor ON — the Round is declined.

## What you just proved

You demonstrated the load-bearing claim of Veritas: a peer-prediction settlement layer is only safe if you guarantee an honest majority in every scoring unit. With the floor ON, a coordinated attack is slashed and the [Leaderboard](/core-concepts#leaderboard) stays trustworthy; with it OFF, the same attack captures the Round. The majority floor is what makes "no oracle" survive contact with adversaries.
