import { describe, it, expect } from "vitest";
import { updateReputation, applyRound, DEFAULT_EMA_ALPHA } from "../src/reputation";
import type { Round } from "../src/domain";
import { gridFor } from "./synthetic";

describe("updateReputation — EMA of per-Round scores", () => {
  it("seeds to the first Round's score on cold start (no prior)", () => {
    expect(updateReputation(undefined, 0.8)).toBeCloseTo(0.8);
  });

  it("blends the new Round's score with the prior via the EMA weight", () => {
    // α = 0.3: new = 0.3·0.5 + 0.7·1.0 = 0.85
    expect(updateReputation(1.0, 0.5, 0.3)).toBeCloseTo(0.85);
  });

  it("decays toward 0 after a slashed (score 0) Round", () => {
    const dropped = updateReputation(0.9, 0, DEFAULT_EMA_ALPHA);
    expect(dropped).toBeLessThan(0.9);
    expect(dropped).toBeGreaterThan(0); // one bad Round doesn't wipe the record
  });
});

describe("applyRound — Reputation from a scored Round", () => {
  const signal = ["a", "b", "c"];
  const round: Round = {
    answerSpace: ["a", "b", "c"],
    // three correlated Workers + one constant Worker carrying no signal (slashed)
    reports: gridFor({ w1: signal, w2: signal, w3: signal, k: ["a", "a", "a"] }),
  };

  it("raises honest Workers and pins a slashed Worker toward 0", () => {
    const reps = applyRound({}, round);
    expect(reps["k"]).toBeCloseTo(0); // sub-threshold ⇒ normalized 0
    for (const id of ["w1", "w2", "w3"]) expect(reps["w1"]!).toBeGreaterThan(0);
    expect(reps["w1"]!).toBeGreaterThan(reps["k"]!);
  });

  it("leaves Workers not in the Round untouched", () => {
    const reps = applyRound({ absent: 0.7 }, round);
    expect(reps["absent"]).toBeCloseTo(0.7);
  });

  it("treats a voided (sub-Quorum) Round as neutral: no Reputation change", () => {
    // Only 2 revealing Workers — below Quorum, so the Round is voided.
    const subQuorum: Round = {
      answerSpace: ["a", "b", "c"],
      reports: gridFor({ w1: signal, w2: signal }),
    };
    const before = { w1: 0.6, w2: 0.4 };
    const after = applyRound(before, subQuorum);
    expect(after).toEqual(before);
  });
});
