import { describe, it, expect } from "vitest";
import { isEligible, eligiblePool } from "../src/tier";

describe("isEligible — Tier reputation floors", () => {
  it("admits an unproven Worker to probation but not to premium", () => {
    expect(isEligible(undefined, "probation")).toBe(true); // cold-start path
    expect(isEligible(undefined, "premium")).toBe(false);
  });
});

describe("eligiblePool — Workers at or above a Tier's floor", () => {
  // Raw-score-space Reputations (ADR-0006): raw rarely approaches 1, so floors are small.
  const reputations = { unproven: 0, mid: 0.25, top: 0.5 };

  it("includes only Workers clearing the Tier floor", () => {
    expect(eligiblePool(reputations, "probation").sort()).toEqual(["mid", "top", "unproven"]);
    expect(eligiblePool(reputations, "standard").sort()).toEqual(["mid", "top"]);
    expect(eligiblePool(reputations, "premium")).toEqual(["top"]);
  });

  it("excludes a demonstrated-dishonest Worker (negative Reputation) from probation", () => {
    expect(eligiblePool({ bad: -0.3, fresh: 0 }, "probation")).toEqual(["fresh"]);
  });
});
