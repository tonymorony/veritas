/**
 * The agents layer re-exports the web demo's contract shapes and extends `RoundResult`
 * with an optional `engineUsed` field. The base shapes are duplicated here (not imported
 * from `apps/web`) because `packages/agents` must not depend on the web app — but they are
 * kept byte-for-byte compatible with `apps/web/src/sim/types.ts` so `POST /api/round`
 * returns JSON the existing frontend renders unchanged.
 */
import type { Report, WorkerScore, Settlement, Tier } from "@x402-plays/core";

/** A Worker in the demo swarm, with a persistent identity across Rounds. */
export type Archetype = "honest" | "reference" | "sloppy" | "sybil";

export interface SimWorker {
  id: string;
  label: string;
  archetype: Archetype;
  /** Persistent raw-CA EMA reputation (ADR-0006). */
  reputation: number;
  tier: Tier;
  roundsPlayed: number;
}

export interface SwarmComposition {
  honest: number;
  reference: number;
  sloppy: number;
  /** Driven by the collusion slider. */
  sybil: number;
}

export interface RoundParams {
  /** N evaluation Tasks (prompts) in the Round. */
  numTasks: number;
  /** M Workers assigned to the Round. */
  roundSize: number;
  baseReward: number;
  stake: number;
  honestAccuracy: number;
  /** The model the Sybil cartel collude to pump in the Leaderboard. */
  sybilTarget: string;
  sybilStrategy: "naive" | "coordinated";
  /** ADR-0005 reputable-majority floor. Off = the unsafe counterfactual. */
  enforceMajorityFloor: boolean;
  seed: number;
}

export interface MockTx {
  worker: string;
  amount: number;
  hash: string;
  latencyMs: number;
}

export interface LeaderboardRow {
  model: string;
  peerWins: number;
  truthWins: number;
}

/** Which engine actually produced a Round (the demo's `simulated` model vs real LLMs). */
export type Engine = "live" | "simulated";

/** Everything the UI needs to render one settled (or refused) Round. */
export interface RoundResult {
  roundId: number;
  params: RoundParams;
  models: string[];
  assigned: SimWorker[];
  excludedSybils: SimWorker[];
  reports: Report[];
  grid: Record<string, string[]>;
  scores: WorkerScore[];
  settlement: Settlement;
  txs: MockTx[];
  leaderboard: LeaderboardRow[];
  truthMatch: number;
  inverted: boolean;
  refused: boolean;
  refusedReason?: string;
  /**
   * The engine that actually ran this Round. `engine: "live"` falls back to `"simulated"`
   * when no provider keys are configured; this field reports what truly happened.
   * Optional so the value remains assignable to web's `RoundResult` (which lacks it).
   */
  engineUsed?: Engine;
}
