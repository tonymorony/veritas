import type { Round, Settlement, SettlementParams, WorkerSettlement, WorkerId } from "./domain";
import { scoreRound } from "./scorer";

/**
 * Settle a Round: score it, then compute every Report's payout, slashing, and the
 * Requester refund in bulk (ADR-0001). Pure and deterministic — the same verifiable,
 * recomputable settlement anyone can reproduce from the on-chain Reports.
 *
 * Each Report draws `baseReward × normalized_CA_score` from the Escrow. Sub-threshold
 * Workers forfeit `slashFraction` of Stake; that Stake is redistributed to honest Workers.
 */
export function settleRound(round: Round, params: SettlementParams): Settlement {
  const { baseReward, stake, slashFraction = 0.5 } = params;
  const scores = scoreRound(round);

  // #Reports each Worker submitted (every Report draws the Worker's normalized score).
  const reportCount = new Map<WorkerId, number>();
  for (const r of round.reports) reportCount.set(r.worker, (reportCount.get(r.worker) ?? 0) + 1);

  const escrow = baseReward * round.reports.length;

  const workers: WorkerSettlement[] = scores.map((s) => {
    const reward = baseReward * s.normalized * (reportCount.get(s.worker) ?? 0);
    const slashed = s.slashed ? slashFraction * stake : 0;
    return {
      worker: s.worker,
      reward,
      stakeReturned: stake - slashed,
      slashed,
      redistribution: 0,
    };
  });

  // Redistribute slashed Stake to honest (above-threshold) Workers, pro-rata by reward.
  // Stakes are uniform, so a quality weight is what makes "pro-rata" meaningful: the
  // most honest/productive Workers absorb the largest share of the colluders' Stake.
  const totalSlashed = workers.reduce((a, w) => a + w.slashed, 0);
  const honestReward = workers.reduce((a, w) => a + (w.slashed === 0 ? w.reward : 0), 0);
  if (totalSlashed > 0 && honestReward > 0) {
    for (const w of workers) {
      if (w.slashed === 0) w.redistribution = totalSlashed * (w.reward / honestReward);
    }
  }
  // With no honest recipient, slashed Stake has nowhere to go; it refunds to the
  // Requester rather than vanishing (keeps USDC conserved).
  const undistributed = honestReward > 0 ? 0 : totalSlashed;

  const totalRewards = workers.reduce((a, w) => a + w.reward, 0);

  return { workers, escrow, requesterRefund: escrow - totalRewards + undistributed };
}
