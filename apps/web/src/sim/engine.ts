import {
  scoreRound,
  settleRound,
  applyRound,
  assignWorkers,
  TIERS,
  mulberry32,
  shuffle,
  type Report,
  type Round,
  type ReputationMap,
  type Tier,
} from "@x402-plays/core";
import type {
  Archetype,
  LeaderboardRow,
  MockTx,
  RoundParams,
  RoundResult,
  SimWorker,
  SwarmComposition,
} from "./types";

/** Models under evaluation = the Round's coarse Answer space (ADR-0004). */
export const MODELS = ["GPT-5", "Claude", "Gemini", "Llama"] as const;

/** Hidden ground-truth quality skew (the protocol never sees this). */
const QUALITY: Record<string, number> = { "GPT-5": 3, Claude: 4, Gemini: 2, Llama: 1 };

/** Starting reputation by archetype — an established marketplace, not genesis. */
const SEED_REP: Record<Archetype, number> = {
  reference: 0.5,
  honest: 0.32,
  sloppy: 0,
  sybil: 0,
};

const LABELS: Record<Archetype, string> = {
  reference: "Reference",
  honest: "Worker",
  sloppy: "Lazy",
  sybil: "Sybil",
};

function tierOf(rep: number): Tier {
  if (rep >= TIERS.premium.reputationFloor) return "premium";
  if (rep >= TIERS.standard.reputationFloor) return "standard";
  return "probation";
}

function weightedPick(items: readonly string[], weight: Record<string, number>, rng: () => number) {
  const total = items.reduce((a, m) => a + weight[m]!, 0);
  let r = rng() * total;
  for (const m of items) {
    r -= weight[m]!;
    if (r <= 0) return m;
  }
  return items[items.length - 1]!;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

/**
 * The Veritas demo swarm. Holds persistent Worker Reputation across Rounds and runs each
 * Round through the REAL `@x402-plays/core` pipeline: assign → report → score → settle →
 * update Reputation. The latent ground truth exists only to score the demo's honesty — it
 * is never fed to the protocol.
 */
export class VeritasSim {
  workers: SimWorker[] = [];
  private reputations: ReputationMap = {};
  roundId = 0;

  constructor(composition: SwarmComposition) {
    this.rebuildSwarm(composition);
  }

  /** Rebuild the swarm to a composition, preserving Reputation of surviving Workers. */
  rebuildSwarm(c: SwarmComposition) {
    const make = (archetype: Archetype, n: number, prefix: string): SimWorker[] =>
      Array.from({ length: n }, (_, i) => {
        const id = `${prefix}${i + 1}`;
        const reputation = this.reputations[id] ?? SEED_REP[archetype];
        this.reputations[id] = reputation;
        return {
          id,
          label: `${LABELS[archetype]} ${i + 1}`,
          archetype,
          reputation,
          tier: tierOf(reputation),
          roundsPlayed: 0,
        };
      });

    this.workers = [
      ...make("reference", c.reference, "ref"),
      ...make("honest", c.honest, "w"),
      ...make("sloppy", c.sloppy, "lazy"),
      ...make("sybil", c.sybil, "syb"),
    ];
  }

  private byId(id: string): SimWorker | undefined {
    return this.workers.find((w) => w.id === id);
  }

  /** How a Worker answers a Task given the latent truth. */
  private answer(w: SimWorker, truth: string, taskIdx: number, p: RoundParams, rng: () => number) {
    const others = MODELS.filter((m) => m !== truth);
    switch (w.archetype) {
      case "reference":
        return rng() < 0.92 ? truth : pick(others, rng);
      case "honest":
        return rng() < p.honestAccuracy ? truth : pick(others, rng);
      case "sloppy":
        return pick(MODELS, rng); // lazy: ignores the Task
      case "sybil": {
        if (p.sybilStrategy === "naive") {
          // Pump one model regardless of Task. CA slashes this (no Task signal), even as
          // a majority — the classic "vote our own model #1" cartel.
          return p.sybilTarget;
        }
        // Coordinated cartel: a shared, Task-varying decoy sequence (pre-agreed, not the
        // truth), identical across all Sybils. They farm mutual agreement, so as a majority
        // this inverts CA; the reputable-majority floor keeps them a minority (ADR-0005).
        const dr = mulberry32(taskIdx * 7919 + 1013);
        return pick(MODELS, dr);
      }
    }
  }

  runRound(p: RoundParams): RoundResult {
    this.roundId += 1;
    const rng = mulberry32(p.seed + this.roundId * 104729);
    const models = [...MODELS];

    const reference = this.workers.filter((w) => w.archetype === "reference");
    const sybils = this.workers.filter((w) => w.archetype === "sybil");

    // 1. Assignment.
    let assigned: SimWorker[];
    let refused = false;
    let refusedReason: string | undefined;

    if (p.enforceMajorityFloor) {
      const pool = this.workers.filter((w) => w.archetype !== "reference").map((w) => w.id);
      try {
        const ids = assignWorkers({
          pool,
          reputations: this.reputations,
          referenceWorkers: reference.map((w) => w.id),
          roundSize: p.roundSize,
          seed: p.seed + this.roundId,
        });
        assigned = ids.map((id) => this.byId(id)!).filter(Boolean);
      } catch (e) {
        refused = true;
        refusedReason = (e as Error).message;
        assigned = [];
      }
    } else {
      // Unsafe counterfactual: Sybils crowd in first and can seize a majority.
      const reputable = this.workers.filter((w) => w.archetype === "honest" || w.archetype === "reference");
      const ordered = [...sybils, ...shuffle(reputable, rng)];
      assigned = ordered.slice(0, p.roundSize);
    }

    if (refused) {
      return this.refusedResult(p, models, refusedReason!);
    }

    const assignedSet = new Set(assigned.map((w) => w.id));
    const excludedSybils = sybils.filter((w) => !assignedSet.has(w.id));

    // 2. Latent truths + Reports over the worker×task grid.
    const truths = Array.from({ length: p.numTasks }, () => weightedPick(models, QUALITY, rng));
    const reports: Report[] = [];
    const grid: Record<string, string[]> = {};
    for (const w of assigned) grid[w.id] = [];
    truths.forEach((truth, t) => {
      for (const w of assigned) {
        const a = this.answer(w, truth, t, p, rng);
        reports.push({ worker: w.id, task: `t${t}`, answer: a });
        grid[w.id]!.push(a);
      }
    });

    const round: Round = { answerSpace: models, reports };

    // 3. Real core: score, settle, update persistent Reputation.
    const scores = scoreRound(round);
    const settlement = settleRound(round, { baseReward: p.baseReward, stake: p.stake });
    this.reputations = applyRound(this.reputations, round);
    for (const w of assigned) {
      w.reputation = this.reputations[w.id] ?? w.reputation;
      w.tier = tierOf(w.reputation);
      w.roundsPlayed += 1;
    }

    // 4. Quality-weighted peer Leaderboard + ground-truth comparison.
    const weight: Record<string, number> = {};
    for (const s of scores) weight[s.worker] = Math.max(0, s.normalized);
    const peerWins: Record<string, number> = Object.fromEntries(models.map((m) => [m, 0]));
    const truthWins: Record<string, number> = Object.fromEntries(models.map((m) => [m, 0]));
    let matched = 0;
    truths.forEach((truth, t) => {
      truthWins[truth] += 1;
      const tally: Record<string, number> = Object.fromEntries(models.map((m) => [m, 0]));
      for (const w of assigned) tally[grid[w.id]![t]!]! += weight[w.id] ?? 0;
      const winner = models.reduce((best, m) => (tally[m]! > tally[best]! ? m : best), models[0]!);
      peerWins[winner] += 1;
      if (winner === truth) matched += 1;
    });
    const leaderboard: LeaderboardRow[] = models
      .map((model) => ({ model, peerWins: peerWins[model]!, truthWins: truthWins[model]! }))
      .sort((a, b) => b.peerWins - a.peerWins);

    // 5. Mock Circle nanopayment settlement.
    const txs: MockTx[] = settlement.workers
      .filter((w) => w.reward > 0)
      .map((w) => ({
        worker: w.worker,
        amount: w.reward,
        hash: mockHash(rng),
        latencyMs: 220 + Math.floor(rng() * 480),
      }));

    // 6. Inversion detector.
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const honestNorm = mean(
      scores
        .filter((s) => this.byId(s.worker)?.archetype === "honest" || this.byId(s.worker)?.archetype === "reference")
        .map((s) => s.normalized),
    );
    const sybilNorm = mean(
      scores.filter((s) => this.byId(s.worker)?.archetype === "sybil").map((s) => s.normalized),
    );
    const inverted = sybils.length > 0 && sybilNorm > honestNorm && sybilNorm > 0;

    return {
      roundId: this.roundId,
      params: p,
      models,
      assigned,
      excludedSybils,
      reports,
      grid,
      scores,
      settlement,
      txs,
      leaderboard,
      truthMatch: p.numTasks ? matched / p.numTasks : 0,
      inverted,
      refused: false,
    };
  }

  private refusedResult(p: RoundParams, models: string[], reason: string): RoundResult {
    return {
      roundId: this.roundId,
      params: p,
      models,
      assigned: [],
      excludedSybils: [],
      reports: [],
      grid: {},
      scores: [],
      settlement: { workers: [], escrow: 0, requesterRefund: 0, treasury: 0, voided: false },
      txs: [],
      leaderboard: models.map((model) => ({ model, peerWins: 0, truthWins: 0 })),
      truthMatch: 0,
      inverted: false,
      refused: true,
      refusedReason: reason,
    };
  }
}

function mockHash(rng: () => number): string {
  const hex = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 12; i++) s += hex[Math.floor(rng() * 16)];
  return s + "…";
}
