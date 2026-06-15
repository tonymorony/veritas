/**
 * Integration test for the ChainSettler against a REAL local anvil (real EVM, real txs).
 *
 * Spawns `anvil` on an ephemeral port, runs a full off-chain Round through `settleOnChain`, and
 * asserts on real artifacts: 32-byte tx hashes, three deployed addresses, and USDC balances that
 * actually moved (honest Workers paid, slashed Sybil stake reduced, Requester refunded).
 *
 * Skips gracefully when `anvil` is not on PATH so CI without Foundry still passes.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mnemonicToAccount } from "viem/accounts";
import { ChainSettler } from "../src/chain";
import { loadConfig } from "../src/config";
import { VeritasMarketplace, type RoundParams, type RoundResult } from "@x402-plays/agents";

const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";
const PORT = 8599; // off the default 8545 to avoid clashing with a dev anvil
const RPC_URL = `http://127.0.0.1:${PORT}`;

const anvilAvailable = spawnSync("anvil", ["--version"], { stdio: "ignore" }).status === 0;

const ROUND_PARAMS: RoundParams = {
  numTasks: 12,
  roundSize: 7,
  baseReward: 5,
  stake: 4,
  honestAccuracy: 0.85,
  sybilTarget: "Claude",
  sybilStrategy: "naive",
  enforceMajorityFloor: true,
  seed: 42,
};

const HEX32 = /^0x[0-9a-fA-F]{64}$/;

let anvil: ChildProcess | undefined;

async function waitForRpc(url: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("anvil did not become ready in time");
}

describe.skipIf(!anvilAvailable)("ChainSettler against a real anvil", () => {
  beforeAll(async () => {
    anvil = spawn("anvil", ["--port", String(PORT), "--mnemonic", ANVIL_MNEMONIC], {
      stdio: "ignore",
    });
    await waitForRpc(RPC_URL);
  }, 20_000);

  afterAll(() => {
    anvil?.kill("SIGKILL");
  });

  it("settles a Round on chain: real hashes, deployed addresses, moved balances", async () => {
    const config = { ...loadConfig({}), chainMode: "local" as const, chainRpcUrl: RPC_URL };
    const settler = new ChainSettler(config);
    await settler.init();

    const addrs = settler.addresses();
    expect(addrs.usdc).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(addrs.reputation).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(addrs.escrow).toMatch(/^0x[0-9a-fA-F]{40}$/);

    // Compute a real off-chain Round.
    const marketplace = new VeritasMarketplace({ honest: 5, reference: 2, sloppy: 1, sybil: 3 });
    const offChain: RoundResult = await marketplace.runRound({
      params: ROUND_PARAMS,
      engine: "simulated",
    });
    expect(offChain.refused).toBe(false);

    const requester = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 0 }).address;
    // Snapshot balances before settlement.
    const beforeRequester = await settler.usdcBalance(requester);
    const beforeWorkers = await Promise.all(
      offChain.assigned.map((_w, i) => settler.usdcBalance(settler.workerAddress(i))),
    );

    const settled = await settler.settleOnChain(offChain);

    // Real settle tx hash + chain metadata.
    expect(settled.chain).toBeDefined();
    expect(settled.chain!.settleTx).toMatch(HEX32);
    expect(Object.keys(settled.chain!.addresses).sort()).toEqual(["escrow", "reputation", "usdc"]);

    // Every payout tx hash is a real 32-byte hash (not the 0x… mock).
    expect(settled.txs.length).toBeGreaterThan(0);
    for (const tx of settled.txs) expect(tx.hash).toMatch(HEX32);

    // Balances actually moved.
    const afterRequester = await settler.usdcBalance(requester);
    const afterWorkers = await Promise.all(
      offChain.assigned.map((_w, i) => settler.usdcBalance(settler.workerAddress(i))),
    );

    // Honest Workers come out ahead: at least one assigned Worker's USDC balance rose (reward
    // paid, stake returned). (This seed produces no sub-threshold Worker, so no slash here; the
    // slash path is exercised by the synthetic-slash test below.)
    let someoneGained = false;
    offChain.assigned.forEach((_w, i) => {
      if (afterWorkers[i]! - beforeWorkers[i]! > 0n) someoneGained = true;
    });
    expect(someoneGained).toBe(true);

    // Requester is refunded the unspent escrow (escrow − total payouts), so net spend < full escrow.
    // The Requester pays escrow then receives a refund; the net change must be negative (spent some)
    // but strictly greater than −fullEscrow (quality-scaled payouts are below the max).
    const baseReward = BigInt(ROUND_PARAMS.baseReward) * 1_000_000n;
    const fullEscrow = baseReward * BigInt(ROUND_PARAMS.numTasks) * BigInt(offChain.assigned.length);
    const requesterDelta = afterRequester - beforeRequester;
    expect(requesterDelta).toBeLessThan(0n); // spent something
    expect(requesterDelta).toBeGreaterThan(-fullEscrow); // refunded the unspent remainder

    // Print real artifacts for the demo log.
    console.log("[chain.test] settleTx:", settled.chain!.settleTx);
    console.log("[chain.test] addresses:", settled.chain!.addresses);
    console.log("[chain.test] sample payout hashes:", settled.txs.slice(0, 2).map((t) => t.hash));
  }, 60_000);

  it("slashes a sub-threshold Worker on chain (stake forfeited, honest paid)", async () => {
    const config = { ...loadConfig({}), chainMode: "local" as const, chainRpcUrl: RPC_URL };
    const settler = new ChainSettler(config);
    await settler.init();

    // A synthetic 3-Worker Round (meets Quorum) with one sub-threshold (slashed) Worker, so the
    // on-chain 50% partial-slash + redistribution path is exercised deterministically.
    const mk = (worker: string, normalized: number, slashed: boolean) => ({
      worker,
      raw: normalized,
      normalized,
      slashed,
    });
    const grid = { wA: ["x", "x"], wB: ["x", "y"], wC: ["z", "z"] };
    const synthetic = {
      roundId: 9001,
      params: { ...ROUND_PARAMS, numTasks: 2, roundSize: 3 },
      models: ["x", "y", "z"],
      assigned: [
        { id: "wA", label: "A", archetype: "honest", reputation: 0.5, tier: "standard", roundsPlayed: 1 },
        { id: "wB", label: "B", archetype: "honest", reputation: 0.4, tier: "standard", roundsPlayed: 1 },
        { id: "wC", label: "C", archetype: "sybil", reputation: -0.3, tier: "probation", roundsPlayed: 1 },
      ],
      excludedSybils: [],
      reports: [],
      grid,
      scores: [mk("wA", 0.9, false), mk("wB", 0.8, false), mk("wC", 0, true)],
      settlement: {
        workers: [
          { worker: "wA", reward: 9, stakeReturned: 4, slashed: 0, redistribution: 1 },
          { worker: "wB", reward: 8, stakeReturned: 4, slashed: 0, redistribution: 1 },
          { worker: "wC", reward: 0, stakeReturned: 2, slashed: 2, redistribution: 0 },
        ],
        escrow: 0,
        requesterRefund: 0,
        treasury: 0,
        voided: false,
      },
      txs: [
        { worker: "wA", amount: 9, hash: "0xmock", latencyMs: 1 },
        { worker: "wB", amount: 8, hash: "0xmock", latencyMs: 1 },
      ],
      leaderboard: [],
      truthMatch: 1,
      inverted: false,
      refused: false,
    } as unknown as RoundResult;

    const honestAddr = settler.workerAddress(0); // wA
    const slashedAddr = settler.workerAddress(2); // wC
    const beforeHonest = await settler.usdcBalance(honestAddr);
    const beforeSlashed = await settler.usdcBalance(slashedAddr);

    const settled = await settler.settleOnChain(synthetic);
    expect(settled.chain!.settleTx).toMatch(HEX32);

    const afterHonest = await settler.usdcBalance(honestAddr);
    const afterSlashed = await settler.usdcBalance(slashedAddr);

    // Honest Worker gained (reward + redistribution); slashed Worker lost part of their stake.
    expect(afterHonest - beforeHonest).toBeGreaterThan(0n);
    expect(afterSlashed - beforeSlashed).toBeLessThan(0n);
    console.log(
      "[chain.test] slash deltas — honest:",
      (afterHonest - beforeHonest).toString(),
      "slashed:",
      (afterSlashed - beforeSlashed).toString(),
    );
  }, 60_000);
});
