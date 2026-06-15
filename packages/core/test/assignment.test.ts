import { describe, it, expect } from "vitest";
import { assignWorkers, type AssignmentInput } from "../src/assignment";

// A Sybil-heavy eligible pool: five unproven colluders, two reputable Reference Workers.
const sybilHeavy = (seed: number): AssignmentInput => ({
  pool: ["s1", "s2", "s3", "s4", "s5"],
  reputations: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0, ref1: 1, ref2: 1 },
  referenceWorkers: ["ref1", "ref2"],
  roundSize: 5,
  floor: 2,
  seed,
});

const reputableCount = (assigned: string[], input: AssignmentInput): number =>
  assigned.filter(
    (w) => input.referenceWorkers!.includes(w) || (input.reputations[w] ?? 0) >= 0.5,
  ).length;

describe("assignWorkers — reputable-Worker floor (ADR-0005)", () => {
  it("draws roundSize Workers including at least the reputable floor", () => {
    const input = sybilHeavy(1);
    const assigned = assignWorkers(input);
    expect(assigned).toHaveLength(5);
    expect(reputableCount(assigned, input)).toBeGreaterThanOrEqual(2);
  });

  it("guarantees the floor on every seed — the cap is structural, not probabilistic", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const input = sybilHeavy(seed);
      const assigned = assignWorkers(input);
      expect(new Set(assigned).size).toBe(5); // no duplicate Workers
      // Sybils can never occupy all M slots: ≥ floor are reputable/Reference.
      expect(reputableCount(assigned, input)).toBeGreaterThanOrEqual(2);
    }
  });

  it("is deterministic in the seed", () => {
    expect(assignWorkers(sybilHeavy(7))).toEqual(assignWorkers(sybilHeavy(7)));
  });
});
