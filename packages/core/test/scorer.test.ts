import { describe, it, expect } from "vitest";
import { scoreRound } from "../src/scorer";
import type { Round, WorkerScore } from "../src/domain";
import { buildRound, honest, fixed, random, mean, type WorkerSpec } from "./synthetic";

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

  it("defeats a colluding subgroup that reports a fixed answer", () => {
    const answerSpace = ["a", "b", "c"];
    const honestIds = ["h1", "h2", "h3", "h4", "h5"];
    const colluderIds = ["c1", "c2", "c3"];
    const workers: WorkerSpec[] = [
      ...honestIds.map((id) => ({ id, strategy: honest(0.8) })),
      ...colluderIds.map((id) => ({ id, strategy: fixed("b") })), // pre-agreed fixed answer
    ];

    const round = buildRound({ answerSpace, numTasks: 14, workers, seed: 7 });
    const scores = byWorker(scoreRound(round));

    const honestMean = mean(honestIds.map((id) => scores[id]!.raw));
    const colluderMean = mean(colluderIds.map((id) => scores[id]!.raw));

    expect(honestMean).toBeGreaterThan(colluderMean);
    for (const id of colluderIds) {
      expect(scores[id]!.slashed).toBe(true); // collusion does not pay: raw <= 0
    }
  });

  it("rewards truthful Workers over a random reporter (~zero expected score)", () => {
    // A single random draw can wander positive by chance; the real property is
    // an expected-value one, so average over many Rounds.
    const answerSpace = ["a", "b", "c"];
    const honestIds = ["h1", "h2", "h3", "h4", "h5"];

    const honestMeans: number[] = [];
    const randomScores: number[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const workers: WorkerSpec[] = [
        ...honestIds.map((id) => ({ id, strategy: honest(0.8) })),
        { id: "rng", strategy: random },
      ];
      const scores = byWorker(scoreRound(buildRound({ answerSpace, numTasks: 16, workers, seed })));
      honestMeans.push(mean(honestIds.map((id) => scores[id]!.raw)));
      randomScores.push(scores["rng"]!.raw);
    }

    const honestAvg = mean(honestMeans);
    const randomAvg = mean(randomScores);
    expect(honestAvg).toBeGreaterThan(0.2); // truthful clearly rewarded
    expect(randomAvg).toBeLessThan(honestAvg);
    expect(Math.abs(randomAvg)).toBeLessThan(0.05); // noise earns ~nothing in expectation
  });
});
