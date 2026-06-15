/**
 * The Veritas API. Reuses `@x402-plays/agents` (worker-agent layer) and `@x402-plays/core`
 * (the real mechanism). Holds marketplace state in memory. The round/leaderboard endpoints
 * sit behind the x402 gate (ADR-0003).
 *
 * Endpoints:
 *   GET  /health           → liveness.
 *   GET  /api/state        → workers (reputation/tier) + round count + engine/x402 mode.
 *   POST /api/round        → run a Round; returns a RoundResult (x402-gated).
 *   POST /api/reset        → reset reputations/swarm.
 *   GET  /api/leaderboard  → latest cumulative leaderboard (x402-gated).
 */
import express, { type Express } from "express";
import cors from "cors";
import type { Engine, RoundParams, SwarmComposition } from "@x402-plays/agents";
import { loadConfig, type ServerConfig } from "./config";
import { MarketplaceState } from "./state";
import { makeX402Gate } from "./x402";
import { getChainSettler } from "./chain";

const DEFAULT_PARAMS: RoundParams = {
  numTasks: 14,
  roundSize: 7,
  baseReward: 5,
  stake: 4,
  honestAccuracy: 0.85,
  sybilTarget: "GPT-5",
  sybilStrategy: "naive",
  enforceMajorityFloor: true,
  seed: 7,
};

export function createApp(config: ServerConfig = loadConfig()): Express {
  const app = express();
  // When chain settlement is on, hand the marketplace a ChainSettler; it deploys/connects
  // lazily on first round so server boot stays fast and offline-friendly.
  const chainSettler = config.chainMode === "off" ? undefined : getChainSettler(config);
  const state = new MarketplaceState(undefined, chainSettler);

  app.use(express.json());
  app.use(cors({ origin: config.corsOrigins, exposedHeaders: ["X-Payment-Response"] }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, engine: config.engine, x402Mode: config.x402Mode, chainMode: config.chainMode });
  });

  app.get("/api/state", (_req, res) => {
    res.json({
      workers: state.workers,
      roundCount: state.roundCount,
      engine: config.engine,
      x402Mode: config.x402Mode,
      chainMode: config.chainMode,
    });
  });

  app.post("/api/reset", (req, res) => {
    const composition = (req.body?.composition as SwarmComposition | undefined) ?? undefined;
    state.reset(composition);
    res.json({ ok: true, roundCount: state.roundCount, workers: state.workers });
  });

  // x402-gated round settlement.
  app.post("/api/round", makeX402Gate(config, "/api/round"), async (req, res) => {
    const params: RoundParams = { ...DEFAULT_PARAMS, ...(req.body?.params ?? {}) };
    const composition = req.body?.composition as SwarmComposition | undefined;
    // Per-request engine override; defaults to the server's configured engine.
    const engine: Engine = (req.body?.engine as Engine | undefined) ?? config.engine;
    try {
      const result = await state.runRound(params, composition, engine);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: "round failed", detail: (e as Error).message });
    }
  });

  // x402-gated leaderboard pull.
  app.get("/api/leaderboard", makeX402Gate(config, "/api/leaderboard"), (_req, res) => {
    res.json({ leaderboard: state.leaderboard(), roundCount: state.roundCount });
  });

  return app;
}
