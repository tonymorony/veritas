import { describe, it, expect } from "vitest";
import { settleRound } from "../src/settlement";
import { applyRound } from "../src/reputation";
import type { ReputationMap } from "../src/reputation";
import { buildRound, honest, fixed, mean, type WorkerSpec } from "./synthetic";

/**
 * End-to-end: a stream of Rounds through the full off-chain pipeline
 * (build → settle → update Reputation). Over many Rounds, honest Workers must both
 * out-earn and out-rank a fixed-answer colluding subgroup — the system's whole point.
 */
describe("Round lifecycle — honesty wins over a stream of Rounds", () => {
  it("pays and promotes honest Workers above colluders cumulatively", () => {
    const answerSpace = ["a", "b", "c"];
    const honestIds = ["h1", "h2", "h3", "h4"];
    const colluderIds = ["c1", "c2"];
    const workers: WorkerSpec[] = [
      ...honestIds.map((id) => ({ id, strategy: honest(0.85) })),
      ...colluderIds.map((id) => ({ id, strategy: fixed("a") })),
    ];

    const params = { baseReward: 5, stake: 4 };
    let reputations: ReputationMap = {};
    const earnings: Record<string, number> = Object.fromEntries(
      [...honestIds, ...colluderIds].map((id) => [id, 0]),
    );

    for (let seed = 1; seed <= 25; seed++) {
      const round = buildRound({ answerSpace, numTasks: 12, workers, seed });
      const settlement = settleRound(round, params);
      reputations = applyRound(reputations, round);
      for (const w of settlement.workers) {
        // net P&L vs the Stake put up: reward + Stake back + redistribution − Stake
        earnings[w.worker]! += w.reward + w.stakeReturned + w.redistribution - params.stake;
      }
    }

    const honestEarn = mean(honestIds.map((id) => earnings[id]!));
    const colluderEarn = mean(colluderIds.map((id) => earnings[id]!));
    const honestRep = mean(honestIds.map((id) => reputations[id]!));
    const colluderRep = mean(colluderIds.map((id) => reputations[id]!));

    expect(honestEarn).toBeGreaterThan(colluderEarn);
    expect(colluderEarn).toBeLessThan(0); // colluding loses money on net
    expect(honestRep).toBeGreaterThan(colluderRep);
    expect(colluderRep).toBeLessThan(0.1); // colluders never build Reputation
  });
});
