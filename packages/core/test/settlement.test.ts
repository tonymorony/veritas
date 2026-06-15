import { describe, it, expect } from "vitest";
import { settleRound } from "../src/settlement";
import type { Round, Report } from "../src/domain";

const gridFor = (specs: Record<string, string[]>): Report[] => {
  const reports: Report[] = [];
  for (const [worker, answers] of Object.entries(specs)) {
    answers.forEach((answer, i) => reports.push({ worker, task: `t${i}`, answer }));
  }
  return reports;
};

describe("settleRound — payouts", () => {
  it("pays an honest, perfectly-correlated Round in full and refunds nothing", () => {
    // Distinct answer per Task => zero chance baseline => raw 1 => normalized 1 for all.
    const signal = ["a", "b", "c"];
    const round: Round = {
      answerSpace: ["a", "b", "c"],
      reports: gridFor({ w1: signal, w2: signal, w3: signal }),
    };

    const settlement = settleRound(round, { baseReward: 10, stake: 5 });
    const byWorker = Object.fromEntries(settlement.workers.map((w) => [w.worker, w]));

    // 3 Reports each × baseReward 10 × normalized 1
    for (const id of ["w1", "w2", "w3"]) {
      expect(byWorker[id]!.reward).toBeCloseTo(30);
      expect(byWorker[id]!.stakeReturned).toBeCloseTo(5);
      expect(byWorker[id]!.slashed).toBeCloseTo(0);
      expect(byWorker[id]!.redistribution).toBeCloseTo(0);
    }
    expect(settlement.escrow).toBeCloseTo(90); // baseReward × 9 Reports
    expect(settlement.requesterRefund).toBeCloseTo(0);
  });

  it("slashes a sub-threshold Worker, pays it nothing, and refunds its unearned reward", () => {
    const signal = ["a", "b", "c"];
    const round: Round = {
      answerSpace: ["a", "b", "c"],
      // three correlated Workers + one constant Worker carrying no Task signal (raw <= 0)
      reports: gridFor({ w1: signal, w2: signal, w3: signal, k: ["a", "a", "a"] }),
    };

    const settlement = settleRound(round, { baseReward: 10, stake: 8 });
    const byWorker = Object.fromEntries(settlement.workers.map((w) => [w.worker, w]));

    // sub-threshold Worker: zero reward, 50% of Stake forfeited
    expect(byWorker["k"]!.reward).toBeCloseTo(0);
    expect(byWorker["k"]!.slashed).toBeCloseTo(4); // 0.5 × 8
    expect(byWorker["k"]!.stakeReturned).toBeCloseTo(4); // remaining half

    // honest Workers earn (positive reward) and keep their full Stake
    for (const id of ["w1", "w2", "w3"]) {
      expect(byWorker[id]!.reward).toBeGreaterThan(0);
      expect(byWorker[id]!.slashed).toBeCloseTo(0);
      expect(byWorker[id]!.stakeReturned).toBeCloseTo(8);
    }

    // Escrow covers 12 Reports (4 Workers × 3); quality-scaled payouts fall short of
    // the max, so the unearned remainder refunds to the Requester.
    expect(settlement.escrow).toBeCloseTo(120);
    expect(settlement.requesterRefund).toBeGreaterThan(0);
  });

  it("redistributes slashed Stake to honest Workers, reward-weighted", () => {
    const signal = ["a", "b", "c"];
    const round: Round = {
      answerSpace: ["a", "b", "c"],
      reports: gridFor({ w1: signal, w2: signal, w3: signal, k: ["a", "a", "a"] }),
    };

    const settlement = settleRound(round, { baseReward: 10, stake: 8 });
    const byWorker = Object.fromEntries(settlement.workers.map((w) => [w.worker, w]));

    // The single slashed Worker forfeits 4; that 4 is shared among the honest Workers.
    const totalRedistributed = settlement.workers.reduce((a, w) => a + w.redistribution, 0);
    expect(totalRedistributed).toBeCloseTo(4); // == total slashed (Stake is conserved)
    expect(byWorker["k"]!.redistribution).toBeCloseTo(0); // a slashed Worker gets no share

    // honest Workers earn equal reward here, so they split the slashed Stake evenly
    for (const id of ["w1", "w2", "w3"]) {
      expect(byWorker[id]!.redistribution).toBeCloseTo(4 / 3);
    }
  });
});
