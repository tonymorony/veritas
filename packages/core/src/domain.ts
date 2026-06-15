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
