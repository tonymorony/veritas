import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";

const ROUND_BODY = {
  params: {
    numTasks: 12,
    roundSize: 7,
    baseReward: 5,
    stake: 4,
    honestAccuracy: 0.82,
    sybilTarget: "Claude",
    sybilStrategy: "naive",
    enforceMajorityFloor: true,
    seed: 42,
  },
  composition: { honest: 5, reference: 2, sloppy: 1, sybil: 3 },
};

const archetypeMean = (scores: any[], assigned: any[], kinds: string[]) => {
  const ids = new Set(assigned.filter((w) => kinds.includes(w.archetype)).map((w) => w.id));
  const xs = scores.filter((s) => ids.has(s.worker)).map((s) => s.normalized);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
};

describe("server /api/round", () => {
  it("runs a real Round and returns a scored RoundResult (gate off)", async () => {
    const app = createApp({ ...loadConfig({}), x402Mode: "off" });
    const res = await request(app).post("/api/round").send(ROUND_BODY);

    expect(res.status).toBe(200);
    expect(res.body.refused).toBe(false);
    expect(res.body.scores).toHaveLength(7);
    expect(res.body.engineUsed).toBe("simulated");
    // honest Workers out-score the Sybils — the real mechanism, server-side
    const honest = archetypeMean(res.body.scores, res.body.assigned, ["honest", "reference"]);
    const sybil = archetypeMean(res.body.scores, res.body.assigned, ["sybil"]);
    expect(honest).toBeGreaterThan(sybil);
    expect(res.body.leaderboard).toHaveLength(4);
  });

  it("health reports ok", async () => {
    const app = createApp({ ...loadConfig({}), x402Mode: "off" });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe("x402 gate (mock mode)", () => {
  it("defaults to mock mode so the gate is functional in the demo", () => {
    expect(loadConfig({}).x402Mode).toBe("mock");
  });

  const mockApp = () => createApp({ ...loadConfig({}), x402Mode: "mock" });

  it("returns 402 with payment requirements when X-PAYMENT is missing", async () => {
    const res = await request(mockApp()).post("/api/round").send(ROUND_BODY);
    expect(res.status).toBe(402);
    expect(Array.isArray(res.body.accepts)).toBe(true);
    expect(res.body.accepts[0]).toHaveProperty("payTo");
  });

  it("accepts the Round when an X-PAYMENT header is present", async () => {
    const res = await request(mockApp())
      .post("/api/round")
      .set("X-PAYMENT", "demo")
      .send(ROUND_BODY);
    expect(res.status).toBe(200);
    expect(res.headers["x-payment-response"]).toBeDefined();
    expect(res.body.refused).toBe(false);
  });
});
