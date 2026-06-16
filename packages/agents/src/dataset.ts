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
 * 24 hardcoded eval Tasks with a deliberately BALANCED `bestModel` distribution — 6 Tasks
 * each for GPT-5, Claude, Gemini and Llama. Balance matters: a skewed latent truth lets a
 * judge get away with always answering one favourite, which is exactly the always-popular
 * behaviour CA must penalise. A balanced spread forces honest judges to genuinely
 * discriminate per Task, giving the worker×task grid the cross-task variance CA needs.
 * Each prompt's demands point at the matching model's strength profile (see providers.ts).
 */
export const DATASET: EvalTask[] = [
  // --- Claude: long-context faithfulness, careful refactoring/editing, rigorous review (6) ---
  { id: "d0", prompt: "Refactor a 2000-line legacy module into testable units while preserving behaviour. Which model produces the most reliable result?", bestModel: "Claude" },
  { id: "d1", prompt: "Summarise a 40-page legal contract and flag every indemnity clause without missing any. Which model is most faithful?", bestModel: "Claude" },
  { id: "d7", prompt: "Draft a polite but firm customer-refund denial email with the right tone. Which model is best?", bestModel: "Claude" },
  { id: "d9", prompt: "Convert a verbose REST handler to idiomatic typed TypeScript, preserving every edge case. Which model is best?", bestModel: "Claude" },
  { id: "d15", prompt: "Audit a Solidity function for re-entrancy and report findings rigorously. Which model is most rigorous?", bestModel: "Claude" },
  { id: "d18", prompt: "Read a 30k-token incident postmortem and extract every action item with its owner faithfully. Which model is best?", bestModel: "Claude" },

  // --- GPT-5: precise coding, algorithms, regex/SQL, step-by-step technical reasoning (6) ---
  { id: "d2", prompt: "Write a competitive-programming solution to a hard graph problem under a tight token budget. Which model is best?", bestModel: "GPT-5" },
  { id: "d5", prompt: "Generate a SQL migration that backfills a column with zero downtime. Which model is best?", bestModel: "GPT-5" },
  { id: "d10", prompt: "Explain CRDTs to a junior engineer with one correct worked example and careful reasoning. Which model is best?", bestModel: "GPT-5" },
  { id: "d13", prompt: "Write a regex to validate international phone numbers across formats. Which model is best?", bestModel: "GPT-5" },
  { id: "d19", prompt: "Solve a multi-step combinatorics problem and show each algebraic step. Which model is best?", bestModel: "GPT-5" },
  { id: "d20", prompt: "Implement a lock-free ring buffer in Rust with correct memory ordering. Which model is best?", bestModel: "GPT-5" },

  // --- Gemini: multimodal (charts/images), translation, concise marketing copy (6) ---
  { id: "d3", prompt: "Translate idiomatic Japanese marketing copy into natural English. Which model is best?", bestModel: "Gemini" },
  { id: "d6", prompt: "Caption a chart image and extract the underlying data table. Which model is best?", bestModel: "Gemini" },
  { id: "d11", prompt: "Produce a punchy marketing tagline for a budget airline. Which model is best?", bestModel: "Gemini" },
  { id: "d16", prompt: "Describe the contents of a product photo and list every visible item. Which model is best?", bestModel: "Gemini" },
  { id: "d21", prompt: "Translate a German technical datasheet into fluent English while preserving units. Which model is best?", bestModel: "Gemini" },
  { id: "d22", prompt: "Read a screenshot of a dashboard and summarise the three key metrics shown. Which model is best?", bestModel: "Gemini" },

  // --- Llama: lightweight, open-ended creative and casual short-form generation (6) ---
  { id: "d8", prompt: "Write a playful haiku about distributed consensus. Which model is best?", bestModel: "Llama" },
  { id: "d14", prompt: "Compose a short whimsical bedtime story for a 4-year-old. Which model is best?", bestModel: "Llama" },
  { id: "d17", prompt: "Brainstorm ten quirky names for a coffee shop on Mars. Which model is best?", bestModel: "Llama" },
  { id: "d23", prompt: "Write a casual, upbeat tweet announcing a Friday office pizza party. Which model is best?", bestModel: "Llama" },
  { id: "d24", prompt: "Improvise a silly limerick about a cat who loves spreadsheets. Which model is best?", bestModel: "Llama" },
  { id: "d25", prompt: "Suggest a fun, low-effort icebreaker game for a small remote team. Which model is best?", bestModel: "Llama" },
];
