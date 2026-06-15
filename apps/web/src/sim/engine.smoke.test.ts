import { describe, it, expect } from "vitest";
import { VeritasSim } from "./engine";
import type { RoundParams } from "./types";

const base: RoundParams = {
  numTasks: 14,
  roundSize: 7,
  baseReward: 5,
  stake: 4,
  honestAccuracy: 0.85,
  sybilTarget: "GPT-5",
  sybilStrategy: "naive",
  enforceMajorityFloor: true,
  seed: 7,
};

const archetypeOf = (sim: VeritasSim, id: string) => sim.workers.find((w) => w.id === id)?.archetype;

describe("VeritasSim — demo behaves like the mechanism", () => {
  it("with the floor on: honest Workers out-score and out-earn Sybils, leaderboard tracks truth", () => {
    const sim = new VeritasSim({ honest: 5, reference: 2, sloppy: 1, sybil: 3 });
    // Warm up reputations over a few Rounds.
    let r = sim.runRound(base);
    for (let i = 0; i < 4; i++) r = sim.runRound(base);

    const honest = r.scores.filter((s) => {
      const a = archetypeOf(sim, s.worker);
      return a === "honest" || a === "reference";
    });
    const sybil = r.scores.filter((s) => archetypeOf(sim, s.worker) === "sybil");
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

    expect(r.refused).toBe(false);
    if (sybil.length > 0) {
      expect(mean(honest.map((s) => s.normalized))).toBeGreaterThan(mean(sybil.map((s) => s.normalized)));
      expect(sybil.some((s) => s.slashed)).toBe(true); // collusion gets slashed
    }
    expect(r.truthMatch).toBeGreaterThan(0.6); // peer leaderboard ≈ ground truth
    expect(r.inverted).toBe(false);
  });

  it("with the floor off and a coordinated Sybil majority: CA inverts (ranking rigged)", () => {
    const sim = new VeritasSim({ honest: 2, reference: 0, sloppy: 0, sybil: 6 });
    const r = sim.runRound({
      ...base,
      roundSize: 7,
      sybilStrategy: "coordinated",
      enforceMajorityFloor: false,
    });
    expect(r.refused).toBe(false);
    expect(r.inverted).toBe(true); // the counterfactual the floor prevents
  });

  it("refuses the Round when reputable Workers can't form a majority (ADR-0005)", () => {
    const sim = new VeritasSim({ honest: 1, reference: 0, sloppy: 0, sybil: 8 });
    const r = sim.runRound({ ...base, roundSize: 7, enforceMajorityFloor: true });
    expect(r.refused).toBe(true);
  });

  it("conserves money every Round (escrow + stake in == payouts + stake + redistribution + refund + treasury)", () => {
    const sim = new VeritasSim({ honest: 5, reference: 2, sloppy: 1, sybil: 3 });
    for (let i = 0; i < 6; i++) {
      const r = sim.runRound({ ...base, seed: 100 + i });
      if (r.refused) continue;
      const s = r.settlement;
      const stakeIn = base.stake * s.workers.length;
      const out =
        s.workers.reduce((a, w) => a + w.reward + w.stakeReturned + w.redistribution, 0) +
        s.requesterRefund +
        s.treasury;
      expect(out).toBeCloseTo(s.escrow + stakeIn);
    }
  });
});
