import type { Round, WorkerId } from "./domain";
import { scoreRound } from "./scorer";
import { meetsQuorum } from "./quorum";

/** Smoothing factor for the Reputation EMA: weight on the newest Round's score. */
export const DEFAULT_EMA_ALPHA = 0.3;

/** Each Worker's running honesty record, written to ERC-8004 (CONTEXT.md: Reputation). */
export type ReputationMap = Record<WorkerId, number>;

/**
 * EMA update of a Worker's honesty record from one Round's normalized CA score
 * (CONTEXT.md: Reputation). On cold start (no prior) Reputation seeds to the first
 * observation, so an Agent's record is meaningful from its very first Round.
 */
export function updateReputation(
  prior: number | undefined,
  roundScore: number,
  alpha: number = DEFAULT_EMA_ALPHA,
): number {
  if (prior === undefined) return roundScore;
  return alpha * roundScore + (1 - alpha) * prior;
}

/**
 * Apply a scored Round to a ReputationMap, EMA-updating each participating Worker from
 * its normalized CA score. Returns a new map; Workers absent from the Round are unchanged.
 */
export function applyRound(
  reputations: ReputationMap,
  round: Round,
  alpha: number = DEFAULT_EMA_ALPHA,
): ReputationMap {
  // A voided Round is neutral: no scoring, no Reputation change (CONTEXT.md: Voided Round).
  if (!meetsQuorum(round)) return { ...reputations };

  const next: ReputationMap = { ...reputations };
  for (const s of scoreRound(round)) {
    next[s.worker] = updateReputation(reputations[s.worker], s.normalized, alpha);
  }
  return next;
}
