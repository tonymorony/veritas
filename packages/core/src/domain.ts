/**
 * Core domain types for Proof-of-Honesty. See CONTEXT.md for the glossary.
 */

/** A categorical label drawn from a Round's coarse Answer space (ADR-0004). */
export type Answer = string;
export type WorkerId = string;
export type TaskId = string;

/** A Worker's answer for one Task — the atomic thing that gets paid. Prediction-free (multi-task CA). */
export interface Report {
  worker: WorkerId;
  task: TaskId;
  answer: Answer;
}

/** One Requester's homogeneous batch of Tasks, worked as a full worker×task grid. */
export interface Round {
  /** Permitted categorical answers; kept coarse (≤3–4 options) in v1. */
  answerSpace: Answer[];
  /** The grid: one Report per (worker, task). */
  reports: Report[];
}

/** A Worker's Correlated Agreement result for a Round. */
export interface WorkerScore {
  worker: WorkerId;
  /** Raw CA score; can be negative (worse than chance). */
  raw: number;
  /** raw mapped affinely into [0,1] and clamped, for payout. */
  normalized: number;
  /** True when raw ≤ 0 (below the honesty threshold) ⇒ partial slash (ADR-0004). */
  slashed: boolean;
}

/** Economic parameters for settling a Round (a Tier's terms; see CONTEXT.md). */
export interface SettlementParams {
  /** Per-Report amount, paid in full only at normalized score 1. */
  baseReward: number;
  /** Per-Worker Stake at risk of slashing. */
  stake: number;
  /** Fraction of Stake forfeited by a sub-threshold Worker. Defaults to 0.5. */
  slashFraction?: number;
}

/** A single Worker's outcome from Settlement. */
export interface WorkerSettlement {
  worker: WorkerId;
  /** Σ over the Worker's Reports of baseReward × normalized score (drawn from Escrow). */
  reward: number;
  /** Stake returned to the Worker (full Stake unless slashed). */
  stakeReturned: number;
  /** Own Stake forfeited (0 unless sub-threshold). */
  slashed: number;
  /** Share of other Workers' slashed Stake received (honest Workers only). */
  redistribution: number;
}

/** The result of settling a Round: per-Worker outcomes plus Requester refund. */
export interface Settlement {
  workers: WorkerSettlement[];
  /** Escrow the Requester locked: baseReward × total Reports (max payout). */
  escrow: number;
  /** Escrow returned to the Requester (the gap between max and quality-scaled payouts). */
  requesterRefund: number;
  /** Slashed Stake with no honest recipient, routed to the protocol treasury (ADR-0007). */
  treasury: number;
  /** True when the Round failed Quorum: fully refunded, no slash, no Leaderboard rows. */
  voided: boolean;
}
