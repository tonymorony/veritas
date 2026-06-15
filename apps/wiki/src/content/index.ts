import introduction from "./introduction.md?raw";
import coreConcepts from "./core-concepts.md?raw";
import correlatedAgreement from "./correlated-agreement.md?raw";
import architecture from "./architecture.md?raw";
import guideDemo from "./guide-demo.md?raw";
import guideCollusion from "./guide-collusion.md?raw";
import api from "./api.md?raw";
import faq from "./faq.md?raw";

export interface DocPage {
  /** Route slug. The introduction lives at "/" but its markdown file is introduction.md. */
  slug: string;
  /** Basename of the .md file (also the /md/<file>.md fetch path). */
  file: string;
  title: string;
  /** One-line description for sidebar tooltips and llms.txt. */
  description: string;
  markdown: string;
}

export interface DocSection {
  title: string;
  pages: DocPage[];
}

export const SECTIONS: DocSection[] = [
  {
    title: "Get started",
    pages: [
      {
        slug: "",
        file: "introduction",
        title: "Introduction",
        description:
          "What Veritas is, the no-ground-truth problem, the peer-prediction solution, and who it's for.",
        markdown: introduction,
      },
      {
        slug: "core-concepts",
        file: "core-concepts",
        title: "Core concepts",
        description:
          "The full glossary: Round, Worker, Report, commit–reveal, Correlated Agreement, Quorum, Stake, Slash, Settlement, Reputation, Tier, Leaderboard, Reference Worker.",
        markdown: coreConcepts,
      },
    ],
  },
  {
    title: "Mechanism",
    pages: [
      {
        slug: "correlated-agreement",
        file: "correlated-agreement",
        title: "How Correlated Agreement works",
        description:
          "The peer-prediction intuition: score the surprise in agreement, no ground truth, truth-telling is dominant, collusion and random answering score ≤ 0. With a worked example.",
        markdown: correlatedAgreement,
      },
      {
        slug: "architecture",
        file: "architecture",
        title: "Architecture",
        description:
          "The round lifecycle, why off-chain scoring is verifiable-not-trusted, the Circle/Arc/ERC-8004/8183 primitive mapping, and the reputable-majority floor. Summarizes ADR-0001 to 0007.",
        markdown: architecture,
      },
    ],
  },
  {
    title: "Guides",
    pages: [
      {
        slug: "guide-demo",
        file: "guide-demo",
        title: "Run the live demo",
        description:
          "Step-by-step walkthrough of the demo dashboard: controls, worker×task grid, settlement ledger, Circle feed, reputation, and leaderboard.",
        markdown: guideDemo,
      },
      {
        slug: "guide-collusion",
        file: "guide-collusion",
        title: "The collusion attack & the majority floor",
        description:
          "The flagship guide: inject Sybils and watch the majority floor ON (cartel slashed, leaderboard correct) vs OFF (cartel captures the Round, CA inverts, ranking rigged).",
        markdown: guideCollusion,
      },
    ],
  },
  {
    title: "Reference",
    pages: [
      {
        slug: "api",
        file: "api",
        title: "API reference",
        description:
          "The @x402-plays/core public functions: scoreRound, settleRound, meetsQuorum, updateReputation, applyRound, isEligible, eligiblePool, assignWorkers, TIERS. A pure, deterministic, recomputable core.",
        markdown: api,
      },
      {
        slug: "faq",
        file: "faq",
        title: "FAQ",
        description:
          "What stops collusion, why no oracle, what the Leaderboard is for, is scoring trusted, what's mocked vs real in the demo.",
        markdown: faq,
      },
    ],
  },
];

export const ALL_PAGES: DocPage[] = SECTIONS.flatMap((s) => s.pages);

export const pageBySlug = (slug: string): DocPage | undefined =>
  ALL_PAGES.find((p) => p.slug === slug);
