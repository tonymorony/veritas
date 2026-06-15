import type { WorkerId } from "./domain";
import type { ReputationMap } from "./reputation";
import { TIERS } from "./tier";
import { mulberry32, shuffle } from "./random";

export interface AssignmentInput {
  /** The Round's eligible pool (Workers clearing the Tier's Reputation floor). */
  pool: WorkerId[];
  reputations: ReputationMap;
  /** Protocol-run known-honest Workers available to satisfy the floor (ADR-0005). */
  referenceWorkers?: WorkerId[];
  /** M — the number of Workers to assign. */
  roundSize: number;
  /** Minimum reputable/Reference Workers. Defaults to a majority, ⌊M/2⌋+1 (ADR-0005). */
  floor?: number;
  /** Seed for the random draw (models on-chain `prevrandao`). */
  seed: number;
}

/** A Worker is reputable if it clears the standard-Tier floor or is a Reference Worker. */
function isReputable(w: WorkerId, reps: ReputationMap, reference: Set<WorkerId>): boolean {
  return reference.has(w) || (reps[w] ?? 0) >= TIERS.standard.reputationFloor;
}

/**
 * Randomly draw `roundSize` Workers with a guaranteed majority of reputable/Reference
 * Workers, so Sybils are always a minority (ADR-0005). The reputable floor is filled first
 * (from reputable Agents, topped up by Reference Workers), then the remaining slots are
 * drawn from the rest of the candidates. Deterministic in `seed`. Throws if the available
 * reputable Workers can't fill the floor — such a Round is unsafe to run.
 */
export function assignWorkers(input: AssignmentInput): WorkerId[] {
  const { pool, reputations, roundSize, seed } = input;
  const floor = input.floor ?? Math.floor(roundSize / 2) + 1;
  const reference = new Set(input.referenceWorkers ?? []);
  const rng = mulberry32(seed);

  // Candidates: the eligible pool plus the always-available Reference Workers.
  const candidates = [...new Set([...pool, ...reference])];
  const reputable = candidates.filter((w) => isReputable(w, reputations, reference));
  const rest = candidates.filter((w) => !isReputable(w, reputations, reference));

  if (reputable.length < floor) {
    throw new Error(
      `Cannot assign Round: ${reputable.length} reputable Workers available, floor requires ${floor} (ADR-0005)`,
    );
  }

  const shuffledReputable = shuffle(reputable, rng);
  const floorPick = shuffledReputable.slice(0, floor);

  const remaining = shuffle([...shuffledReputable.slice(floor), ...rest], rng);
  const fill = remaining.slice(0, Math.max(0, roundSize - floorPick.length));

  return [...floorPick, ...fill];
}
