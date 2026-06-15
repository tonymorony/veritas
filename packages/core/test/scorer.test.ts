import { describe, it, expect } from "vitest";
import { scoreRound } from "../src/scorer";
import type { Round, WorkerScore } from "../src/domain";
import { buildRound, honest, fixed, mean, type WorkerSpec } from "./synthetic";

const byWorker = (scores: WorkerScore[]): Record<string, WorkerScore> =>
  Object.fromEntries(scores.map((s) => [s.worker, s]));

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

  it("rewards truthful Workers over an always-popular Worker", () => {
    const answerSpace = ["a", "b", "c"];
    const honestIds = ["h1", "h2", "h3", "h4", "h5"];
    const workers: WorkerSpec[] = [
      ...honestIds.map((id) => ({ id, strategy: honest(0.8) })),
      { id: "pop", strategy: fixed("a") }, // always reports the popular "a"
    ];

    const round = buildRound({ answerSpace, numTasks: 12, workers, seed: 42 });
    const scores = byWorker(scoreRound(round));

    const honestMean = mean(honestIds.map((id) => scores[id]!.raw));
    expect(honestMean).toBeGreaterThan(0); // truthful reporting is genuinely rewarded
    expect(honestMean).toBeGreaterThan(scores["pop"]!.raw);
  });
});
