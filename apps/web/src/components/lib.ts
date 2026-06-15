import type { Archetype } from "../sim/types";

/** Per-model visual identity for the grid + leaderboard. */
export const MODEL_STYLE: Record<string, { letter: string; hue: string; soft: string }> = {
  "GPT-5": { letter: "G", hue: "#5B8DEF", soft: "rgba(91,141,239,0.16)" },
  Claude: { letter: "C", hue: "#F5B94A", soft: "rgba(245,185,74,0.16)" },
  Gemini: { letter: "M", hue: "#A78BFA", soft: "rgba(167,139,250,0.16)" },
  Llama: { letter: "L", hue: "#3DDC97", soft: "rgba(61,220,151,0.16)" },
};

export function modelStyle(model: string) {
  return MODEL_STYLE[model] ?? { letter: model[0] ?? "?", hue: "#8A93A6", soft: "rgba(138,147,166,0.16)" };
}

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  honest: "Honest worker",
  reference: "Reference",
  sloppy: "Lazy",
  sybil: "Sybil",
};

export const ARCHETYPE_DOT: Record<Archetype, string> = {
  honest: "#3DDC97",
  reference: "#5B8DEF",
  sloppy: "#8A93A6",
  sybil: "#FF5C5C",
};

export function fmtUsd(n: number, dp = 2): string {
  return "$" + n.toFixed(dp);
}

export function fmtRep(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(3);
}

export const TIER_FLOORS = { probation: 0, standard: 0.2, premium: 0.4 } as const;
