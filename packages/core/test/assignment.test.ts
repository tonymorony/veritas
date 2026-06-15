import { describe, it, expect } from "vitest";
import { assignWorkers, type AssignmentInput } from "../src/assignment";
import { TIERS } from "../src/tier";

// A Sybil-heavy eligible pool: five unproven colluders, three reputable Reference Workers
// (enough to fill a majority of a 5-Worker Round).
const sybilHeavy = (seed: number): AssignmentInput => ({
  pool: ["s1", "s2", "s3", "s4", "s5"],
  reputations: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, ref1: 1, ref2: 1, ref3: 1 },
  referenceWorkers: ["ref1", "ref2", "ref3"],
  roundSize: 5,
  seed,
});

const reputableCount = (assigned: string[], input: AssignmentInput): number =>
  assigned.filter(
    (w) =>
      input.referenceWorkers!.includes(w) ||
      (input.reputations[w] ?? 0) >= TIERS.standard.reputationFloor,
  ).length;

describe("assignWorkers — reputable-Worker majority floor (ADR-0005)", () => {
  it("draws roundSize Workers, a majority of them reputable", () => {
    const input = sybilHeavy(1);
    const assigned = assignWorkers(input);
    expect(assigned).toHaveLength(5);
    expect(reputableCount(assigned, input)).toBeGreaterThan(5 / 2); // ⌊5/2⌋+1 = 3
  });

  it("keeps Sybils a minority on every seed — the guarantee is structural", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const input = sybilHeavy(seed);
      const assigned = assignWorkers(input);
      expect(new Set(assigned).size).toBe(5); // no duplicate Workers
      expect(reputableCount(assigned, input)).toBeGreaterThan(5 / 2); // reputable majority
    }
  });

  it("refuses to assign a Round when reputable Workers can't fill the majority", () => {
    // Only 2 reputable available, but a 5-Worker Round needs 3 — unsafe to run.
    const input: AssignmentInput = {
      pool: ["s1", "s2", "s3", "s4", "s5"],
      reputations: { ref1: 1, ref2: 1 },
      referenceWorkers: ["ref1", "ref2"],
      roundSize: 5,
      seed: 1,
    };
    expect(() => assignWorkers(input)).toThrow();
  });

  it("is deterministic in the seed", () => {
    expect(assignWorkers(sybilHeavy(7))).toEqual(assignWorkers(sybilHeavy(7)));
  });
});
