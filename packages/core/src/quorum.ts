import type { Round, WorkerId, TaskId } from "./domain";

/** Minimum participation for a Round to be scorable (CONTEXT.md: Quorum). */
export const QUORUM_MIN_WORKERS = 3;
export const QUORUM_MIN_REVEALS_PER_TASK = 2;

/**
 * Whether a Round has enough participation for Correlated Agreement to be meaningful:
 * ≥3 revealing Workers and every scored Task with ≥2 reveals (CONTEXT.md). Below this,
 * the worker×task grid is too sparse and the Round is voided-and-refunded (ADR-0001).
 */
export function meetsQuorum(round: Round): boolean {
  const workers = new Set<WorkerId>();
  const revealsPerTask = new Map<TaskId, number>();
  for (const r of round.reports) {
    workers.add(r.worker);
    revealsPerTask.set(r.task, (revealsPerTask.get(r.task) ?? 0) + 1);
  }

  if (workers.size < QUORUM_MIN_WORKERS) return false;
  for (const count of revealsPerTask.values()) {
    if (count < QUORUM_MIN_REVEALS_PER_TASK) return false;
  }
  return true;
}
