/**
 * Judge providers. A `JudgeProvider` turns one Task (a prompt + the allowed Answer labels)
 * into one Answer label. Real LLM adapters (Anthropic / OpenAI / Google) satisfy the
 * ADR-0002 heterogeneity requirement; the `simulated` provider is the deterministic
 * latent-truth model ported from `apps/web/src/sim/engine.ts`.
 *
 * SDK clients are constructed lazily so the package imports cleanly with no keys present.
 */
import { mulberry32 } from "@x402-plays/core";
import { MODELS, type Model } from "./dataset";

export type ProviderFamily = "anthropic" | "openai" | "google" | "simulated";

/** The input to one judgment: a Task prompt and the valid Answer labels to choose from. */
export interface JudgeInput {
  prompt: string;
  options: readonly string[];
  /** Hidden latent truth — used only by the simulated provider; real LLMs never see it. */
  truth?: string;
  /** Per-(worker,task) seed for deterministic simulated answers. */
  seed?: number;
}

export interface JudgeProvider {
  id: string;
  family: ProviderFamily;
  /** Return one Answer label drawn from `input.options`. */
  judge(input: JudgeInput): Promise<string>;
}

/** Pick a uniformly random valid option (the safe fallback when parsing fails). */
function randomOption(options: readonly string[], rng: () => number): string {
  return options[Math.floor(rng() * options.length)] ?? options[0]!;
}

/**
 * Map free-form model text onto a valid Answer label. The judge is instructed to emit a
 * strict `{"answer":"<model>"}` JSON object; we first try to parse that, then fall back to
 * an earliest-mention substring scan over the raw text, and finally to a random valid label
 * so a malformed response never breaks a Round.
 */
export function parseAnswer(text: string, options: readonly string[], rng: () => number): string {
  const matchOption = (candidate: string): string | undefined => {
    const c = candidate.toLowerCase().trim();
    return options.find((opt) => opt.toLowerCase() === c);
  };

  // 1. Preferred path: a JSON object with an "answer" field, possibly wrapped in prose or
  //    fenced code. Scan all {...} blocks and take the first whose answer is a valid option.
  for (const m of text.matchAll(/\{[^{}]*\}/g)) {
    try {
      const obj = JSON.parse(m[0]) as Record<string, unknown>;
      const ans = obj.answer ?? obj.model ?? obj.best;
      if (typeof ans === "string") {
        const exact = matchOption(ans);
        if (exact) return exact;
      }
    } catch {
      // not valid JSON — fall through to the substring scan
    }
  }

  // 2. Fallback: earliest-mentioned option in the raw text, so "GPT-5, then Claude" picks GPT-5.
  const lower = text.toLowerCase();
  let best: { opt: string; idx: number } | undefined;
  for (const opt of options) {
    const idx = lower.indexOf(opt.toLowerCase());
    if (idx >= 0 && (best === undefined || idx < best.idx)) best = { opt, idx };
  }
  return best?.opt ?? randomOption(options, rng);
}

const SYSTEM =
  "You are an impartial, per-task evaluation judge. For each task you are given the task's " +
  "specific demands and a closed list of candidate models. Reason from THIS task's demands " +
  "and choose the single model whose strengths best fit it.\n\n" +
  "Candidate strength profiles (balanced — no model is best at everything):\n" +
  "- GPT-5: strong at precise coding, algorithms, regex/SQL, and step-by-step technical reasoning.\n" +
  "- Claude: strong at long-context faithfulness, careful editing/refactoring, nuanced writing, and rigorous review.\n" +
  "- Gemini: strong at multimodal (charts/images), translation, and concise marketing/creative copy.\n" +
  "- Llama: lightweight and strong at open-ended creative and casual short-form generation.\n\n" +
  "Rules: pick the best FIT for the specific task, not your favourite. Do NOT default to one " +
  "model across tasks, and do NOT show any self-preference toward your own model family. " +
  "Different tasks should genuinely yield different answers. " +
  'Reply with ONLY a single JSON object of the exact form {"answer":"<one of the exact ' +
  'candidate names>"} — no prose, no code fences, nothing else.';

function userPrompt(input: JudgeInput): string {
  return (
    `Task: ${input.prompt}\n\n` +
    `Candidates (answer with EXACTLY one of these): ${input.options.join(", ")}\n\n` +
    `Respond with only {"answer":"<model>"}.`
  );
}

// --- Real LLM adapters ------------------------------------------------------------------
// Each adapter constructs its SDK client lazily and reads its key from env. Prompts are
// tiny and cheap (single short classification, low max_tokens, no thinking).

export function anthropicProvider(model = "claude-haiku-4-5"): JudgeProvider {
  let clientPromise: Promise<unknown> | undefined;
  const getClient = async () => {
    if (!clientPromise) {
      clientPromise = import("@anthropic-ai/sdk").then(
        (m) => new m.default({ apiKey: process.env.ANTHROPIC_API_KEY }),
      );
    }
    return clientPromise;
  };
  return {
    id: `anthropic:${model}`,
    family: "anthropic",
    async judge(input) {
      const rng = mulberry32((input.seed ?? 0) + 1);
      try {
        const client = (await getClient()) as {
          messages: {
            create(args: unknown): Promise<{ content: Array<{ type: string; text?: string }> }>;
          };
        };
        const res = await client.messages.create({
          model,
          max_tokens: 32,
          system: SYSTEM,
          messages: [{ role: "user", content: userPrompt(input) }],
        });
        const text = res.content.find((b) => b.type === "text")?.text ?? "";
        return parseAnswer(text, input.options, rng);
      } catch {
        return randomOption(input.options, rng);
      }
    },
  };
}

export function openaiProvider(model = "gpt-4o-mini"): JudgeProvider {
  let clientPromise: Promise<unknown> | undefined;
  const getClient = async () => {
    if (!clientPromise) {
      clientPromise = import("openai").then(
        (m) => new m.default({ apiKey: process.env.OPENAI_API_KEY }),
      );
    }
    return clientPromise;
  };
  return {
    id: `openai:${model}`,
    family: "openai",
    async judge(input) {
      const rng = mulberry32((input.seed ?? 0) + 2);
      try {
        const client = (await getClient()) as {
          chat: {
            completions: {
              create(args: unknown): Promise<{ choices: Array<{ message: { content: string | null } }> }>;
            };
          };
        };
        const res = await client.chat.completions.create({
          model,
          max_tokens: 32,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userPrompt(input) },
          ],
        });
        const text = res.choices[0]?.message.content ?? "";
        return parseAnswer(text, input.options, rng);
      } catch {
        return randomOption(input.options, rng);
      }
    },
  };
}

export function googleProvider(model = "gemini-2.0-flash"): JudgeProvider {
  let clientPromise: Promise<unknown> | undefined;
  const getClient = async () => {
    if (!clientPromise) {
      clientPromise = import("@google/genai").then(
        (m) => new m.GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY }),
      );
    }
    return clientPromise;
  };
  return {
    id: `google:${model}`,
    family: "google",
    async judge(input) {
      const rng = mulberry32((input.seed ?? 0) + 3);
      try {
        const client = (await getClient()) as {
          models: { generateContent(args: unknown): Promise<{ text?: string }> };
        };
        const res = await client.models.generateContent({
          model,
          contents: `${SYSTEM}\n\n${userPrompt(input)}`,
        });
        return parseAnswer(res.text ?? "", input.options, rng);
      } catch {
        return randomOption(input.options, rng);
      }
    },
  };
}

// --- Simulated provider -----------------------------------------------------------------

export type SimStrategy =
  | { kind: "reference" }
  | { kind: "honest"; accuracy: number }
  | { kind: "sloppy" }
  | { kind: "sybil-naive"; target: string }
  | { kind: "sybil-coordinated" };

/**
 * The latent-truth provider, ported from `apps/web/src/sim/engine.ts#answer`. Deterministic
 * via per-Task seeds. Sybils collude here (you can't ask an LLM to collude reliably), honest
 * and reference archetypes approximate real judges, sloppy ignores the Task.
 */
export function simulatedProvider(strategy: SimStrategy): JudgeProvider {
  return {
    id: `simulated:${strategy.kind}`,
    family: "simulated",
    async judge(input) {
      const truth = input.truth ?? input.options[0]!;
      const rng = mulberry32((input.seed ?? 0) + 104729);
      const others = input.options.filter((m) => m !== truth);
      const pickOther = () => others[Math.floor(rng() * others.length)] ?? truth;
      const pickAny = () => input.options[Math.floor(rng() * input.options.length)]!;
      switch (strategy.kind) {
        case "reference":
          return rng() < 0.92 ? truth : pickOther();
        case "honest":
          return rng() < strategy.accuracy ? truth : pickOther();
        case "sloppy":
          return pickAny();
        case "sybil-naive":
          // Pump one model regardless of Task — CA slashes this even as a majority.
          return strategy.target;
        case "sybil-coordinated": {
          // A shared, Task-varying decoy sequence (pre-agreed, not the truth), identical
          // across all Sybils — they farm mutual agreement (mirrors engine.ts).
          const taskIdx = input.seed ?? 0;
          const dr = mulberry32(taskIdx * 7919 + 1013);
          return input.options[Math.floor(dr() * input.options.length)]!;
        }
      }
    },
  };
}

/** Which real providers have a configured API key, in round-robin order for heterogeneity. */
export function availableLiveProviders(env: NodeJS.ProcessEnv = process.env): JudgeProvider[] {
  const providers: JudgeProvider[] = [];
  if (env.ANTHROPIC_API_KEY) providers.push(anthropicProvider());
  if (env.OPENAI_API_KEY) providers.push(openaiProvider());
  if (env.GOOGLE_API_KEY) providers.push(googleProvider());
  return providers;
}

export { MODELS, type Model };
