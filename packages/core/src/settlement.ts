import type { Round, Settlement, SettlementParams, WorkerSettlement, WorkerId } from "./domain";
import { scoreRound } from "./scorer";
import { meetsQuorum } from "./quorum";

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
  const escrow = baseReward * round.reports.length;

  // A sub-Quorum Round is voided: Escrow fully refunded, every revealing Worker gets
  // Stake back with no honesty slash, no payouts (ADR-0001, CONTEXT.md: Voided Round).
  if (!meetsQuorum(round)) {
    const revealers = [...new Set(round.reports.map((r) => r.worker))];
    return {
      workers: revealers.map((worker) => ({
        worker,
        reward: 0,
        stakeReturned: stake,
        slashed: 0,
        redistribution: 0,
      })),
      escrow,
      requesterRefund: escrow,
      treasury: 0,
      voided: true,
    };
  }

  const scores = scoreRound(round);

  // #Reports each Worker submitted (every Report draws the Worker's normalized score).
  const reportCount = new Map<WorkerId, number>();
  for (const r of round.reports) reportCount.set(r.worker, (reportCount.get(r.worker) ?? 0) + 1);

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

  // Redistribute slashed Stake to honest (above-threshold) Workers in equal shares.
  // Stakes are uniform, so "pro-rata" is an even split — quality is already paid through
  // base_reward × normalized, so redistribution stays a flat honest-Worker dividend.
  const totalSlashed = workers.reduce((a, w) => a + w.slashed, 0);
  const honest = workers.filter((w) => w.slashed === 0);
  if (totalSlashed > 0 && honest.length > 0) {
    const share = totalSlashed / honest.length;
    for (const w of honest) w.redistribution = share;
  }
  // With no honest recipient, slashed Stake has nowhere to go; it goes to the protocol
  // treasury, never the Requester (ADR-0007), keeping USDC conserved.
  const treasury = honest.length > 0 ? 0 : totalSlashed;

  const totalRewards = workers.reduce((a, w) => a + w.reward, 0);

  return {
    workers,
    escrow,
    requesterRefund: escrow - totalRewards,
    treasury,
    voided: false,
  };
}
