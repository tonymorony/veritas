/**
 * The worker-agent layer. `VeritasMarketplace` holds persistent Worker Reputation across
 * Rounds and runs each Round through the REAL `@x402-plays/core` pipeline: assign → report
 * → score → settle → update Reputation. The latent ground truth exists only to score the
 * demo's honesty — it is never fed to the protocol.
 *
 * Two engines:
 *  - `simulated` (default): reproduces the current `apps/web` demo exactly via the
 *    latent-truth modelled archetypes.
 *  - `live`: honest/reference judgments come from real LLMs (round-robin across whichever
 *    providers have keys, for ADR-0002 heterogeneity); Sybils/sloppy stay modelled. If
 *    `live` is requested with no keys, it falls back to `simulated` and reports `engineUsed`.
 */
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
import { MODELS, DATASET, type EvalTask } from "./dataset";
import {
  simulatedProvider,
  availableLiveProviders,
  type JudgeProvider,
} from "./providers";
import type {
  Archetype,
  Engine,
  LeaderboardRow,
  MockTx,
  RoundParams,
  RoundResult,
  SimWorker,
  SwarmComposition,
} from "./types";

/** Hidden ground-truth quality skew (the protocol never sees this) — mirrors apps/web. */
const QUALITY: Record<string, number> = { "GPT-5": 3, Claude: 4, Gemini: 2, Llama: 1 };

/** Starting reputation by archetype — an established marketplace, not genesis. */
const SEED_REP: Record<Archetype, number> = { reference: 0.5, honest: 0.32, sloppy: 0, sybil: 0 };

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
  const total = items.reduce((a, m) => a + (weight[m] ?? 0), 0);
  let r = rng() * total;
  for (const m of items) {
    r -= weight[m] ?? 0;
    if (r <= 0) return m;
  }
  return items[items.length - 1]!;
}

export interface RunRoundOptions {
  composition: SwarmComposition;
  params: RoundParams;
  /** `live` uses real LLMs for honest/reference judges; `simulated` (default) models all. */
  engine?: Engine;
  /** Inject providers (e.g. a FakeProvider in tests) for the live path. */
  liveProviders?: JudgeProvider[];
  /** Override the eval dataset (defaults to DATASET). */
  dataset?: EvalTask[];
}

/**
 * The Veritas marketplace. Persistent across Rounds; each `runRound` settles one Round
 * through the real core and updates the persistent ReputationMap.
 */
export class VeritasMarketplace {
  workers: SimWorker[] = [];
  reputations: ReputationMap = {};
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

  reset(composition: SwarmComposition) {
    this.reputations = {};
    this.roundId = 0;
    this.rebuildSwarm(composition);
  }

  private byId(id: string): SimWorker | undefined {
    return this.workers.find((w) => w.id === id);
  }

  async runRound(opts: Omit<RunRoundOptions, "composition">): Promise<RoundResult> {
    const p = opts.params;
    const requestedEngine: Engine = opts.engine ?? "simulated";
    const dataset = opts.dataset ?? DATASET;

    // Resolve live providers; fall back to simulated if `live` requested with no keys.
    const liveProviders =
      requestedEngine === "live" ? (opts.liveProviders ?? availableLiveProviders()) : [];
    const engineUsed: Engine =
      requestedEngine === "live" && liveProviders.length > 0 ? "live" : "simulated";

    this.roundId += 1;
    const rng = mulberry32(p.seed + this.roundId * 104729);
    const models = [...MODELS];

    const reference = this.workers.filter((w) => w.archetype === "reference");
    const sybils = this.workers.filter((w) => w.archetype === "sybil");

    // 1. Assignment — real core with the ADR-0005 majority floor, or the unsafe counterfactual.
    let assigned: SimWorker[];
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
        return this.refusedResult(p, models, (e as Error).message, engineUsed);
      }
    } else {
      const reputable = this.workers.filter(
        (w) => w.archetype === "honest" || w.archetype === "reference",
      );
      const ordered = [...sybils, ...shuffle(reputable, rng)];
      assigned = ordered.slice(0, p.roundSize);
    }

    const assignedSet = new Set(assigned.map((w) => w.id));
    const excludedSybils = sybils.filter((w) => !assignedSet.has(w.id));

    // 2. Latent truths over N Tasks. In live mode we draw real prompts from the dataset
    //    (cycling if numTasks exceeds dataset size); the bestModel is the latent truth.
    const tasks: EvalTask[] = Array.from({ length: p.numTasks }, (_, t) => {
      if (engineUsed === "live") return dataset[t % dataset.length]!;
      // Simulated: synthesise a latent truth from the QUALITY skew (mirrors engine.ts).
      return { id: `t${t}`, prompt: "", bestModel: weightedPick(models, QUALITY, rng) as EvalTask["bestModel"] };
    });
    const truths = tasks.map((t) => t.bestModel as string);

    // Round-robin a real provider to each honest/reference worker for heterogeneity.
    const liveByWorker = new Map<string, JudgeProvider>();
    if (engineUsed === "live") {
      let i = 0;
      for (const w of assigned) {
        if (w.archetype === "honest" || w.archetype === "reference") {
          liveByWorker.set(w.id, liveProviders[i % liveProviders.length]!);
          i += 1;
        }
      }
    }

    // 3. Reports over the worker×task grid.
    const reports: Report[] = [];
    const grid: Record<string, string[]> = {};
    for (const w of assigned) grid[w.id] = [];

    for (let t = 0; t < tasks.length; t++) {
      const task = tasks[t]!;
      const truth = truths[t]!;
      // Per-worker answers for this Task (await live calls; simulated resolves immediately).
      const answers = await Promise.all(
        assigned.map((w) =>
          this.answerFor(w, task, truth, t, p, engineUsed, liveByWorker.get(w.id)),
        ),
      );
      assigned.forEach((w, wi) => {
        const a = answers[wi]!;
        reports.push({ worker: w.id, task: `t${t}`, answer: a });
        grid[w.id]!.push(a);
      });
    }

    const round: Round = { answerSpace: models, reports };

    // 4. Real core: score, settle, update persistent Reputation.
    const scores = scoreRound(round);
    const settlement = settleRound(round, { baseReward: p.baseReward, stake: p.stake });
    this.reputations = applyRound(this.reputations, round);
    for (const w of assigned) {
      w.reputation = this.reputations[w.id] ?? w.reputation;
      w.tier = tierOf(w.reputation);
      w.roundsPlayed += 1;
    }

    // 5. Quality-weighted peer Leaderboard + ground-truth comparison (ported from engine.ts).
    const weight: Record<string, number> = {};
    for (const s of scores) weight[s.worker] = Math.max(0, s.normalized);
    const peerWins: Record<string, number> = Object.fromEntries(models.map((m) => [m, 0]));
    const truthWins: Record<string, number> = Object.fromEntries(models.map((m) => [m, 0]));
    let matched = 0;
    truths.forEach((truth, t) => {
      truthWins[truth] = (truthWins[truth] ?? 0) + 1;
      const tally: Record<string, number> = Object.fromEntries(models.map((m) => [m, 0]));
      for (const w of assigned) tally[grid[w.id]![t]!]! += weight[w.id] ?? 0;
      const winner = models.reduce((best, m) => (tally[m]! > tally[best]! ? m : best), models[0]!);
      peerWins[winner] = (peerWins[winner] ?? 0) + 1;
      if (winner === truth) matched += 1;
    });
    const leaderboard: LeaderboardRow[] = models
      .map((model) => ({ model, peerWins: peerWins[model]!, truthWins: truthWins[model]! }))
      .sort((a, b) => b.peerWins - a.peerWins);

    // 6. Mock Circle nanopayment settlement.
    const txs: MockTx[] = settlement.workers
      .filter((w) => w.reward > 0)
      .map((w) => ({
        worker: w.worker,
        amount: w.reward,
        hash: mockHash(rng),
        latencyMs: 220 + Math.floor(rng() * 480),
      }));

    // 7. Inversion detector.
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const honestNorm = mean(
      scores
        .filter((s) => {
          const a = this.byId(s.worker)?.archetype;
          return a === "honest" || a === "reference";
        })
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
      engineUsed,
    };
  }

  /** How a Worker answers a Task. Honest/reference use a real LLM in live mode; the rest
   * (and everything in simulated mode) use the modelled latent-truth strategies. */
  private async answerFor(
    w: SimWorker,
    task: EvalTask,
    truth: string,
    taskIdx: number,
    p: RoundParams,
    engineUsed: Engine,
    liveProvider: JudgeProvider | undefined,
  ): Promise<string> {
    const seed = p.seed + this.roundId * 1009 + taskIdx * 31 + hashId(w.id);
    if (
      engineUsed === "live" &&
      liveProvider &&
      (w.archetype === "honest" || w.archetype === "reference")
    ) {
      return liveProvider.judge({ prompt: task.prompt, options: MODELS, seed });
    }
    const strategy =
      w.archetype === "reference"
        ? simulatedProvider({ kind: "reference" })
        : w.archetype === "honest"
          ? simulatedProvider({ kind: "honest", accuracy: p.honestAccuracy })
          : w.archetype === "sloppy"
            ? simulatedProvider({ kind: "sloppy" })
            : p.sybilStrategy === "naive"
              ? simulatedProvider({ kind: "sybil-naive", target: p.sybilTarget })
              : simulatedProvider({ kind: "sybil-coordinated" });
    return strategy.judge({ prompt: task.prompt, options: MODELS, truth, seed: taskIdx });
  }

  private refusedResult(
    p: RoundParams,
    models: string[],
    reason: string,
    engineUsed: Engine,
  ): RoundResult {
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
      engineUsed,
    };
  }
}

/** Standalone one-shot runner: build a marketplace and settle one Round. */
export async function runRound(opts: RunRoundOptions): Promise<RoundResult> {
  const m = new VeritasMarketplace(opts.composition);
  return m.runRound(opts);
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mockHash(rng: () => number): string {
  const hex = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 12; i++) s += hex[Math.floor(rng() * 16)];
  return s + "…";
}
