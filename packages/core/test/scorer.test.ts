import { describe, it, expect } from "vitest";
import { scoreRound } from "../src/scorer";
import type { Round } from "../src/domain";

describe("scoreRound — Correlated Agreement", () => {
  it("returns one score per Worker, positive for Workers who genuinely correlate", () => {
    // Two Workers who agree on the same Task but vary across Tasks: genuine
    // correlation, not always-same. CA should reward this.
    const round: Round = {
      answerSpace: ["yes", "no"],
      reports: [
        { worker: "w1", task: "t1", answer: "yes" },
        { worker: "w2", task: "t1", answer: "yes" },
        { worker: "w1", task: "t2", answer: "no" },
        { worker: "w2", task: "t2", answer: "no" },
      ],
    };

    const scores = scoreRound(round);

    expect(scores).toHaveLength(2);
    for (const s of scores) {
      expect(s.raw).toBeGreaterThan(0);
    }
  });
});
