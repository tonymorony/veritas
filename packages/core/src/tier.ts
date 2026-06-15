import type { WorkerId } from "./domain";
import type { ReputationMap } from "./reputation";

/** The reputation band a Round is posted at (CONTEXT.md: Tier). */
export type Tier = "probation" | "standard" | "premium";

export interface TierConfig {
  /** Per-Report reward, rising with Tier. */
  baseReward: number;
  /** Per-Worker Stake required to join, rising with Tier. */
  stake: number;
  /** Minimum Reputation to be in this Tier's eligible pool. */
  reputationFloor: number;
}

/**
 * Tier terms. Reputation raises earning power by unlocking higher Tiers, not by
 * per-Worker price multipliers (CONTEXT.md). Values are illustrative v1 defaults.
 * Probation has floor 0 so unproven Agents can bootstrap (the cold-start path).
 */
export const TIERS: Record<Tier, TierConfig> = {
  probation: { baseReward: 1, stake: 1, reputationFloor: 0 },
  standard: { baseReward: 5, stake: 5, reputationFloor: 0.5 },
  premium: { baseReward: 20, stake: 20, reputationFloor: 0.8 },
};

/** Whether a Worker's Reputation clears a Tier's floor. Unproven (undefined) counts as 0. */
export function isEligible(reputation: number | undefined, tier: Tier): boolean {
  return (reputation ?? 0) >= TIERS[tier].reputationFloor;
}

/** Workers eligible for a Tier's Round: those at or above its Reputation floor. */
export function eligiblePool(reputations: ReputationMap, tier: Tier): WorkerId[] {
  return Object.keys(reputations).filter((w) => isEligible(reputations[w], tier));
}
