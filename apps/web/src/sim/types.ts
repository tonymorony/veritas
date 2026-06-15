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
  /**
   * naive = all Sybils pump one model (constant) — CA reliably slashes this, even as a
   * majority. coordinated = a shared Task-varying decoy bloc that can invert CA if it
   * seizes a majority — the sophisticated attack the reputable-majority floor exists to stop.
   */
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
  /** Peer-validated wins (quality-weighted vote across Tasks). */
  peerWins: number;
  /** Hidden ground-truth wins — shown only to score the demo's accuracy. */
  truthWins: number;
}

/** Everything the UI needs to render one settled (or refused) Round. */
export interface RoundResult {
  roundId: number;
  params: RoundParams;
  /** Models being evaluated (the Answer space). */
  models: string[];
  /** The Workers actually assigned this Round. */
  assigned: SimWorker[];
  /** Sybils that tried to join but were crowded out by the majority floor. */
  excludedSybils: SimWorker[];
  /** The worker×task grid. */
  reports: Report[];
  /** answer(workerId, taskIndex). */
  grid: Record<string, string[]>;
  scores: WorkerScore[];
  settlement: Settlement;
  txs: MockTx[];
  leaderboard: LeaderboardRow[];
  /** % of Tasks where the peer-validated winner matched ground truth. */
  truthMatch: number;
  /** True when CA was inverted by a Sybil majority (honest minority slashed). */
  inverted: boolean;
  /** Set when the protocol refused to run the Round (floor unsatisfiable). */
  refused: boolean;
  refusedReason?: string;
  /**
   * On-chain settlement metadata, present only when the server settled this Round on a real
   * EVM chain. The real payout tx hashes live in `txs[].hash`; this carries chain identity,
   * deployed contract addresses and the settle tx. Optional ⇒ unset in the pure-sim path.
   */
  chain?: {
    chainId: number;
    addresses: Record<string, string>;
    settleTx?: string;
  };
}
