import { create } from "zustand";
import { VeritasSim } from "../sim/engine";
import type { RoundParams, RoundResult, SwarmComposition } from "../sim/types";
import { runRoundLive, resetServer, pingServer } from "../sim/api";

export type Engine = "browser" | "server";

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

  /** Where Rounds run: the in-browser sim, or the real backend (apps/server). */
  engine: Engine;
  /** True while a server Round is in flight. */
  busy: boolean;
  serverOnline: boolean;
  /** What the server actually ran last: real LLM agents or its simulated fallback. */
  engineUsed: "live" | "simulated" | null;
  /** x402 access-payment proof from the last gated request (mock/live modes). */
  paymentProof: string | null;

  setEngine: (engine: Engine) => Promise<void>;
  setParam: <K extends keyof RoundParams>(key: K, value: RoundParams[K]) => void;
  setComposition: (partial: Partial<SwarmComposition>) => void;
  setSybils: (n: number) => void;
  runRound: () => Promise<void>;
  runMany: (n: number) => Promise<void>;
  applyPreset: (preset: Preset) => Promise<void>;
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
  engine: "browser",
  busy: false,
  serverOnline: false,
  engineUsed: null,
  paymentProof: null,

  setEngine: async (engine) => {
    if (engine === "server") {
      const online = await pingServer();
      set({ engine, serverOnline: online });
    } else {
      set({ engine, serverOnline: false });
    }
  },

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

  runRound: async () => {
    const { engine, params, composition, sim } = get();
    if (engine === "server") {
      set({ busy: true });
      try {
        const result = await runRoundLive(params, composition);
        set((s) => ({
          result,
          engineUsed: result.engineUsed ?? "simulated",
          paymentProof: result.paymentProof ?? null,
          serverOnline: true,
          history: [...s.history, result].slice(-40),
          rev: s.rev + 1,
        }));
        return;
      } catch {
        // never dead-end the demo: fall back to the in-browser sim
        set({ serverOnline: false, engine: "browser" });
      } finally {
        set({ busy: false });
      }
    }
    const result = sim.runRound(params);
    set((s) => ({ result, history: [...s.history, result].slice(-40), rev: s.rev + 1 }));
  },

  runMany: async (n) => {
    if (get().engine === "server") {
      for (let i = 0; i < n; i++) await get().runRound();
      return;
    }
    const { sim, params } = get();
    let last: RoundResult | null = null;
    const batch: RoundResult[] = [];
    for (let i = 0; i < n; i++) {
      last = sim.runRound(params);
      batch.push(last);
    }
    set((s) => ({ result: last, history: [...s.history, ...batch].slice(-40), rev: s.rev + 1 }));
  },

  applyPreset: async (preset) => {
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
    if (get().engine === "server") {
      await resetServer().catch(() => {});
      await get().runRound();
      return;
    }
    // run a first round so the dashboard is populated immediately
    const result = sim.runRound({ ...get().params });
    set((s) => ({ result, history: [result], rev: s.rev + 1 }));
  },

  reset: () => {
    if (get().engine === "server") resetServer().catch(() => {});
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
