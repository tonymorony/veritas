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
  /** Minimum reputable/Reference Workers in the Assignment. Defaults to 2. */
  floor?: number;
  /** Seed for the random draw (models on-chain `prevrandao`). */
  seed: number;
}

/** A Worker is reputable if it clears the standard-Tier floor or is a Reference Worker. */
function isReputable(w: WorkerId, reps: ReputationMap, reference: Set<WorkerId>): boolean {
  return reference.has(w) || (reps[w] ?? 0) >= TIERS.standard.reputationFloor;
}

/**
 * Randomly draw `roundSize` Workers, guaranteeing a floor of reputable/Reference Workers
 * so no Round is a pure-Sybil majority (ADR-0005). The reputable floor is filled first
 * (from reputable Agents, topped up by Reference Workers), then the remaining slots are
 * drawn from the rest of the candidates. Deterministic in `seed`.
 */
export function assignWorkers(input: AssignmentInput): WorkerId[] {
  const { pool, reputations, roundSize, seed } = input;
  const floor = input.floor ?? 2;
  const reference = new Set(input.referenceWorkers ?? []);
  const rng = mulberry32(seed);

  // Candidates: the eligible pool plus the always-available Reference Workers.
  const candidates = [...new Set([...pool, ...reference])];
  const reputable = candidates.filter((w) => isReputable(w, reputations, reference));
  const rest = candidates.filter((w) => !isReputable(w, reputations, reference));

  const shuffledReputable = shuffle(reputable, rng);
  const floorPick = shuffledReputable.slice(0, floor);

  const remaining = shuffle([...shuffledReputable.slice(floor), ...rest], rng);
  const fill = remaining.slice(0, Math.max(0, roundSize - floorPick.length));

  return [...floorPick, ...fill];
}
