import { describe, it, expect } from "vitest";
import { VeritasMarketplace } from "../src/runner";
import { MODELS } from "../src/dataset";
import type { JudgeProvider } from "../src/providers";
import type { RoundParams } from "../src/types";

const base: RoundParams = {
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

const archetypeOf = (m: VeritasMarketplace, id: string) =>
  m.workers.find((w) => w.id === id)?.archetype;

describe("VeritasMarketplace — simulated engine matches the mechanism", () => {
  it("floor on: honest Workers out-score and out-earn Sybils; leaderboard tracks truth", async () => {
    const m = new VeritasMarketplace({ honest: 5, reference: 2, sloppy: 1, sybil: 3 });
    let r = await m.runRound({ params: base });
    for (let i = 0; i < 4; i++) r = await m.runRound({ params: base });

    const honest = r.scores.filter((s) => {
      const a = archetypeOf(m, s.worker);
      return a === "honest" || a === "reference";
    });
    const sybil = r.scores.filter((s) => archetypeOf(m, s.worker) === "sybil");
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

    expect(r.refused).toBe(false);
    expect(r.engineUsed).toBe("simulated");
    if (sybil.length > 0) {
      expect(mean(honest.map((s) => s.normalized))).toBeGreaterThan(
        mean(sybil.map((s) => s.normalized)),
      );
      expect(sybil.some((s) => s.slashed)).toBe(true);
    }
    expect(r.truthMatch).toBeGreaterThan(0.6);
    expect(r.inverted).toBe(false);
  });

  it("floor off + coordinated Sybil majority: CA inverts (the counterfactual)", async () => {
    const m = new VeritasMarketplace({ honest: 2, reference: 0, sloppy: 0, sybil: 6 });
    const r = await m.runRound({
      params: { ...base, roundSize: 7, sybilStrategy: "coordinated", enforceMajorityFloor: false },
    });
    expect(r.refused).toBe(false);
    expect(r.inverted).toBe(true);
  });

  it("refuses when reputable Workers can't form a majority (ADR-0005)", async () => {
    const m = new VeritasMarketplace({ honest: 1, reference: 0, sloppy: 0, sybil: 8 });
    const r = await m.runRound({ params: { ...base, roundSize: 7, enforceMajorityFloor: true } });
    expect(r.refused).toBe(true);
  });

  it("conserves money every Round", async () => {
    const m = new VeritasMarketplace({ honest: 5, reference: 2, sloppy: 1, sybil: 3 });
    for (let i = 0; i < 6; i++) {
      const r = await m.runRound({ params: { ...base, seed: 100 + i } });
      if (r.refused) continue;
      const s = r.settlement;
      const stakeIn = base.stake * s.workers.length;
      const out =
        s.workers.reduce((a, w) => a + w.reward + w.stakeReturned + w.redistribution, 0) +
        s.requesterRefund +
        s.treasury;
      expect(out).toBeCloseTo(s.escrow + stakeIn);
    }
  });
});

describe("VeritasMarketplace — live engine", () => {
  /** A deterministic honest judge: picks the latent truth most of the time. */
  function fakeHonestProvider(): JudgeProvider {
    let n = 0;
    return {
      id: "fake:honest",
      family: "simulated",
      async judge(input) {
        n += 1;
        // 85% truth, else a rotating wrong answer — high-quality, deterministic.
        if (input.truth && n % 7 !== 0) return input.truth;
        return input.options[n % input.options.length]!;
      },
    };
  }

  it("falls back to simulated when live requested with no providers", async () => {
    const m = new VeritasMarketplace({ honest: 4, reference: 2, sloppy: 1, sybil: 2 });
    const r = await m.runRound({ params: base, engine: "live", liveProviders: [] });
    expect(r.engineUsed).toBe("simulated");
    expect(r.refused).toBe(false);
  });

  it("live path with an injected FakeProvider runs deterministically (no network)", async () => {
    const m = new VeritasMarketplace({ honest: 4, reference: 2, sloppy: 1, sybil: 2 });
    // NOTE: the FakeProvider gets the dataset prompt but no truth (live judges don't see it),
    // so we feed truth via the provider only for this deterministic stand-in.
    const provider: JudgeProvider = {
      id: "fake",
      family: "simulated",
      async judge(input) {
        // Deterministic: always pick the first option (Claude-ish), proving the live wiring.
        return input.options[1]!;
      },
    };
    const r = await m.runRound({ params: base, engine: "live", liveProviders: [provider] });
    expect(r.engineUsed).toBe("live");
    expect(r.refused).toBe(false);
    // Honest/reference reports should all be the provider's fixed choice.
    const honestIds = new Set(
      m.workers.filter((w) => w.archetype === "honest" || w.archetype === "reference").map((w) => w.id),
    );
    const honestReports = r.reports.filter((rep) => honestIds.has(rep.worker));
    expect(honestReports.length).toBeGreaterThan(0);
    expect(honestReports.every((rep) => rep.answer === MODELS[1])).toBe(true);
  });

  it("live with a quality FakeProvider: honest beat Sybils", async () => {
    const m = new VeritasMarketplace({ honest: 5, reference: 2, sloppy: 1, sybil: 3 });
    // Inject a truth-aware fake to simulate competent judges without network.
    const provider = fakeHonestProvider();
    // Wrap so the dataset's bestModel is passed as truth to the fake.
    const truthAware: JudgeProvider = {
      id: "fake:truth",
      family: "simulated",
      judge: (input) => provider.judge({ ...input, truth: input.options[1] }),
    };
    let r = await m.runRound({ params: base, engine: "live", liveProviders: [truthAware] });
    for (let i = 0; i < 3; i++)
      r = await m.runRound({ params: base, engine: "live", liveProviders: [truthAware] });
    expect(r.engineUsed).toBe("live");
    const a = (id: string) => archetypeOf(m, id);
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
    const honest = r.scores.filter((s) => a(s.worker) === "honest" || a(s.worker) === "reference");
    const sybil = r.scores.filter((s) => a(s.worker) === "sybil");
    if (sybil.length > 0) {
      expect(mean(honest.map((s) => s.normalized))).toBeGreaterThan(mean(sybil.map((s) => s.normalized)));
    }
  });
});
