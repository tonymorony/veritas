/**
 * A small real evaluation dataset for Veritas Rounds. Each Task is a prompt plus a hidden
 * "best model" latent truth used only to score the demo's honesty — it is never shown to
 * the protocol. In `live` mode the prompts are handed to real LLM judges; in `simulated`
 * mode the latent truth drives the modelled archetypes (mirroring `apps/web` QUALITY).
 */

/** The Answer space under evaluation — the coarse categorical labels (ADR-0004). */
export const MODELS = ["GPT-5", "Claude", "Gemini", "Llama"] as const;
export type Model = (typeof MODELS)[number];

export interface EvalTask {
  id: string;
  prompt: string;
  /** Hidden ground-truth "best answer" for this Task. The protocol never sees this. */
  bestModel: Model;
}

/**
 * 16 hardcoded eval Tasks. The `bestModel` distribution roughly tracks the web demo's
 * hidden QUALITY skew ({ "GPT-5": 3, Claude: 4, Gemini: 2, Llama: 1 }), so simulated
 * behaviour stays close to the current dashboard while live judging gets real prompts.
 */
export const DATASET: EvalTask[] = [
  { id: "d0", prompt: "Refactor a 2000-line legacy module into testable units while preserving behaviour. Which model produces the most reliable result?", bestModel: "Claude" },
  { id: "d1", prompt: "Summarise a 40-page legal contract and flag every indemnity clause. Which model is most faithful?", bestModel: "Claude" },
  { id: "d2", prompt: "Write a competitive-programming solution under a tight token budget. Which model is best?", bestModel: "GPT-5" },
  { id: "d3", prompt: "Translate idiomatic Japanese marketing copy into natural English. Which model is best?", bestModel: "Gemini" },
  { id: "d4", prompt: "Solve a multi-step physics word problem requiring careful unit tracking. Which model is best?", bestModel: "Claude" },
  { id: "d5", prompt: "Generate a SQL migration that backfills a column with zero downtime. Which model is best?", bestModel: "GPT-5" },
  { id: "d6", prompt: "Caption a chart image and extract the underlying data table. Which model is best?", bestModel: "Gemini" },
  { id: "d7", prompt: "Draft a polite but firm customer-refund denial email. Which model is best?", bestModel: "Claude" },
  { id: "d8", prompt: "Write a haiku about distributed consensus. Which model is best?", bestModel: "Llama" },
  { id: "d9", prompt: "Debug a flaky async test that fails 1-in-50 runs. Which model is best?", bestModel: "Claude" },
  { id: "d10", prompt: "Explain CRDTs to a junior engineer with one worked example. Which model is best?", bestModel: "GPT-5" },
  { id: "d11", prompt: "Produce a marketing tagline for a budget airline. Which model is best?", bestModel: "Gemini" },
  { id: "d12", prompt: "Convert a verbose REST handler to idiomatic typed TypeScript. Which model is best?", bestModel: "Claude" },
  { id: "d13", prompt: "Write a regex to validate international phone numbers. Which model is best?", bestModel: "GPT-5" },
  { id: "d14", prompt: "Compose a short bedtime story for a 4-year-old. Which model is best?", bestModel: "Llama" },
  { id: "d15", prompt: "Audit a Solidity function for re-entrancy. Which model is most rigorous?", bestModel: "Claude" },
];
