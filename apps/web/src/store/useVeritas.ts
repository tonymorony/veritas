import { create } from "zustand";
import { VeritasSim } from "../sim/engine";
import type { RoundParams, RoundResult, SwarmComposition } from "../sim/types";

export const DEFAULT_PARAMS: RoundParams = {
  numTasks: 12,
  roundSize: 7,
  baseReward: 5,
  stake: 4,
  honestAccuracy: 0.82,
  sybilTarget: "Claude",
  sybilStrategy: "naive",
  enforceMajorityFloor: true,
  seed: 42,
};

export const DEFAULT_COMPOSITION: SwarmComposition = {
  honest: 5,
  reference: 2,
  sloppy: 1,
  sybil: 3,
};

export interface Preset {
  id: string;
  label: string;
  blurb: string;
  params: Partial<RoundParams>;
  composition: SwarmComposition;
}

export const PRESETS: Preset[] = [
  {
    id: "healthy",
    label: "Healthy swarm",
    blurb: "Honest majority, no attack. Everyone gets paid.",
    params: { sybilStrategy: "naive", enforceMajorityFloor: true, honestAccuracy: 0.85 },
    composition: { honest: 5, reference: 2, sloppy: 1, sybil: 0 },
  },
  {
    id: "attack",
    label: "Collusion attack",
    blurb: "Sybils flood in — the floor holds, CA slashes them.",
    params: { sybilStrategy: "naive", enforceMajorityFloor: true, honestAccuracy: 0.82 },
    composition: { honest: 5, reference: 2, sloppy: 1, sybil: 4 },
  },
  {
    id: "unsafe",
    label: "Floor OFF — unsafe",
    blurb: "No floor + coordinated cartel. Watch CA invert.",
    params: { sybilStrategy: "coordinated", enforceMajorityFloor: false, honestAccuracy: 0.82 },
    composition: { honest: 3, reference: 2, sloppy: 0, sybil: 5 },
  },
];

interface VeritasState {
  sim: VeritasSim;
  params: RoundParams;
  composition: SwarmComposition;
  result: RoundResult | null;
  history: RoundResult[];
  /** Bumped on every state mutation so React re-reads sim.workers etc. */
  rev: number;
  activePreset: string | null;

  setParam: <K extends keyof RoundParams>(key: K, value: RoundParams[K]) => void;
  setComposition: (partial: Partial<SwarmComposition>) => void;
  setSybils: (n: number) => void;
  runRound: () => void;
  runMany: (n: number) => void;
  applyPreset: (preset: Preset) => void;
  reset: () => void;
}

function makeSim(composition: SwarmComposition) {
  return new VeritasSim(composition);
}

export const useVeritas = create<VeritasState>((set, get) => ({
  sim: makeSim(DEFAULT_COMPOSITION),
  params: DEFAULT_PARAMS,
  composition: DEFAULT_COMPOSITION,
  result: null,
  history: [],
  rev: 0,
  activePreset: null,

  setParam: (key, value) =>
    set((s) => ({ params: { ...s.params, [key]: value }, activePreset: null, rev: s.rev + 1 })),

  setComposition: (partial) => {
    const composition = { ...get().composition, ...partial };
    get().sim.rebuildSwarm(composition);
    set((s) => ({ composition, activePreset: null, rev: s.rev + 1 }));
  },

  setSybils: (n) => {
    const composition = { ...get().composition, sybil: Math.max(0, Math.min(8, n)) };
    get().sim.rebuildSwarm(composition);
    set((s) => ({ composition, activePreset: null, rev: s.rev + 1 }));
  },

  runRound: () => {
    const result = get().sim.runRound(get().params);
    set((s) => ({ result, history: [...s.history, result].slice(-40), rev: s.rev + 1 }));
  },

  runMany: (n) => {
    const { sim, params } = get();
    let last: RoundResult | null = null;
    const batch: RoundResult[] = [];
    for (let i = 0; i < n; i++) {
      last = sim.runRound(params);
      batch.push(last);
    }
    set((s) => ({ result: last, history: [...s.history, ...batch].slice(-40), rev: s.rev + 1 }));
  },

  applyPreset: (preset) => {
    const composition = preset.composition;
    const sim = makeSim(composition);
    set((s) => ({
      sim,
      composition,
      params: { ...s.params, ...preset.params },
      result: null,
      history: [],
      activePreset: preset.id,
      rev: s.rev + 1,
    }));
    // run a first round so the dashboard is populated immediately
    const result = sim.runRound({ ...get().params });
    set((s) => ({ result, history: [result], rev: s.rev + 1 }));
  },

  reset: () => {
    const sim = makeSim(DEFAULT_COMPOSITION);
    set({
      sim,
      params: DEFAULT_PARAMS,
      composition: DEFAULT_COMPOSITION,
      result: null,
      history: [],
      rev: 0,
      activePreset: null,
    });
  },
}));
