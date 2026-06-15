/**
 * In-memory marketplace state: one persistent `VeritasMarketplace` (workers + ReputationMap)
 * plus the latest cumulative leaderboard. Reused across requests for the life of the process.
 */
import {
  VeritasMarketplace,
  type Engine,
  type LeaderboardRow,
  type RoundParams,
  type RoundResult,
  type SwarmComposition,
} from "@x402-plays/agents";
import type { ChainSettler } from "./chain";

const DEFAULT_COMPOSITION: SwarmComposition = { honest: 5, reference: 2, sloppy: 1, sybil: 3 };

export class MarketplaceState {
  private marketplace: VeritasMarketplace;
  private composition: SwarmComposition;
  private latestLeaderboard: LeaderboardRow[] = [];
  /** Optional on-chain settlement seam; undefined ⇒ pure-sim mock txs (CHAIN_MODE=off). */
  private chainSettler?: ChainSettler;
  roundCount = 0;

  constructor(composition: SwarmComposition = DEFAULT_COMPOSITION, chainSettler?: ChainSettler) {
    this.composition = composition;
    this.marketplace = new VeritasMarketplace(composition);
    this.chainSettler = chainSettler;
  }

  get workers() {
    return this.marketplace.workers;
  }

  async runRound(
    params: RoundParams,
    composition: SwarmComposition | undefined,
    engine: Engine,
  ): Promise<RoundResult> {
    // If the caller supplied a new composition, rebuild (preserving surviving reputations).
    if (composition && !sameComposition(composition, this.composition)) {
      this.composition = composition;
      this.marketplace.rebuildSwarm(composition);
    }
    const offChain = await this.marketplace.runRound({ params, engine });
    // Settle on a real EVM chain behind a clean seam; the off-chain round runner is untouched.
    // `CHAIN_MODE=off` (no settler) keeps today's mock txs so the demo runs with zero setup.
    const result = this.chainSettler ? await this.chainSettler.settleOnChain(offChain) : offChain;
    if (!result.refused) {
      this.roundCount += 1;
      this.latestLeaderboard = result.leaderboard;
    }
    return result;
  }

  reset(composition?: SwarmComposition) {
    this.composition = composition ?? DEFAULT_COMPOSITION;
    this.marketplace.reset(this.composition);
    this.roundCount = 0;
    this.latestLeaderboard = [];
  }

  leaderboard(): LeaderboardRow[] {
    return this.latestLeaderboard;
  }
}

function sameComposition(a: SwarmComposition, b: SwarmComposition): boolean {
  return a.honest === b.honest && a.reference === b.reference && a.sloppy === b.sloppy && a.sybil === b.sybil;
}
