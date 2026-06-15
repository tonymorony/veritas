import { describe, it, expect } from "vitest";
import { meetsQuorum } from "../src/quorum";
import type { Round } from "../src/domain";
import { gridFor } from "./synthetic";

describe("meetsQuorum", () => {
  it("accepts a Round with ≥3 revealing Workers and ≥2 reveals on every Task", () => {
    const round: Round = {
      answerSpace: ["a", "b"],
      reports: gridFor({ w1: ["a", "b"], w2: ["a", "b"], w3: ["a", "b"] }),
    };
    expect(meetsQuorum(round)).toBe(true);
  });

  it("rejects a Round with fewer than 3 revealing Workers", () => {
    const round: Round = {
      answerSpace: ["a", "b"],
      reports: gridFor({ w1: ["a", "b"], w2: ["a", "b"] }),
    };
    expect(meetsQuorum(round)).toBe(false);
  });

  it("rejects a Round where some Task has fewer than 2 reveals", () => {
    const round: Round = {
      answerSpace: ["a", "b"],
      reports: [
        ...gridFor({ w1: ["a", "b"], w2: ["a", "b"], w3: ["a"] }),
        // t1 has only w1 and w2; w3 left t1 unrevealed... add a Task only one Worker touched
        { worker: "w1", task: "t2", answer: "a" },
      ],
    };
    expect(meetsQuorum(round)).toBe(false); // t2 has a single reveal
  });
});
