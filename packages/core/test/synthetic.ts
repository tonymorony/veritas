import type { Answer, Report, Round } from "../src/domain";

/** Deterministic PRNG (mulberry32) so synthetic Rounds are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

/** A Worker's answering strategy given the hidden true category of a Task. */
export type Strategy = (truth: Answer, rng: () => number, answerSpace: Answer[]) => Answer;

/** Honest: reports the truth with probability `accuracy`, else a different answer. */
export const honest =
  (accuracy: number): Strategy =>
  (truth, rng, space) => {
    if (rng() < accuracy) return truth;
    const others = space.filter((a) => a !== truth);
    return pick(others, rng);
  };

/** Always reports the same fixed answer, ignoring the Task (always-popular / collusion). */
export const fixed =
  (value: Answer): Strategy =>
  () =>
    value;

/** Uniformly random answer, ignoring the Task. */
export const random: Strategy = (_truth, rng, space) => pick(space, rng);

export interface WorkerSpec {
  id: string;
  strategy: Strategy;
}

/**
 * Build a Round from a latent-truth model: each Task has a hidden true category;
 * each Worker answers per its strategy. Honest Workers correlate through the
 * shared truth; strategic Workers do not.
 */
export function buildRound(opts: {
  answerSpace: Answer[];
  numTasks: number;
  workers: WorkerSpec[];
  seed: number;
}): Round {
  const rng = mulberry32(opts.seed);
  const reports: Report[] = [];
  for (let ti = 0; ti < opts.numTasks; ti++) {
    const truth = pick(opts.answerSpace, rng);
    const task = `t${ti}`;
    for (const w of opts.workers) {
      reports.push({ worker: w.id, task, answer: w.strategy(truth, rng, opts.answerSpace) });
    }
  }
  return { answerSpace: opts.answerSpace, reports };
}

export const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Build a worker×task grid from explicit per-Worker answer lists, e.g.
 * `gridFor({ w1: ["a", "b"], w2: ["a", "b"] })` → Reports on Tasks t0, t1.
 */
export function gridFor(specs: Record<string, Answer[]>): Report[] {
  const reports: Report[] = [];
  for (const [worker, answers] of Object.entries(specs)) {
    answers.forEach((answer, i) => reports.push({ worker, task: `t${i}`, answer }));
  }
  return reports;
}
