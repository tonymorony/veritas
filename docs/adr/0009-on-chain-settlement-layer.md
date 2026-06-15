# On-chain settlement layer: real escrow + reputation contracts, off-chain scoring

To make settlement *real* (USDC actually moves, tx hashes are verifiable) rather than
mocked chrome, we add a Solidity layer (`contracts/`, Foundry) and wire the backend to it
through a `ChainSettler` seam (`apps/server/src/chain.ts`, viem). Three contracts:

- **MockUSDC** — a 6-decimal ERC-20 stand-in for USDC locally; on testnet/mainnet the
  canonical USDC address is used instead (no code change, just config).
- **ReputationRegistry** (ERC-8004-style) — stores each Worker's absolute reputation; the
  `TaskEscrow` is its single authorized writer, set at deploy time.
- **TaskEscrow** (ERC-8183-style) — runs the on-chain Round lifecycle in USDC:
  `openRound → joinAndCommit → reveal → settle` (or `void` below Quorum). It enforces — and
  reverts on violation of — the exact settlement math of `packages/core/src/settlement.ts`:
  per-Report payout `baseReward·numTasks·normalizedBps/BPS`, 50% partial slash for
  revealed-but-sub-threshold Workers, 100% slash for committed-but-not-revealed, equal-share
  redistribution of slashed Stake to honest Workers, orphaned slash → treasury (ADR-0007),
  Requester refund of unspent Escrow, and full USDC conservation.

This honors **ADR-0001**: scoring stays off-chain (the heterogeneous LLM swarm + the CA
scorer in `@x402-plays/core`), and only the finished `RoundResult` — normalized scores,
slash flags, new reputations — is *submitted* on chain by the operator. The contract is the
verifiable arithmetic layer; anyone can recompute the inputs. Commit–reveal on chain is the
anti-front-running / liveness proof, not where the scores come from.

### Modes (`CHAIN_MODE`)

- `off` — no chain; the server returns mocked tx hashes (the zero-config default path).
- `local` — viem connects to a local **anvil**; on first Round the `ChainSettler` deploys
  all three contracts to anvil's deterministic accounts (Requester/operator = acct 0,
  Workers = accts 1..N), mints MockUSDC, and replays every Round as real txs. This is the
  default "real on-chain" demo, since it needs no funded wallet or RPC.
- `testnet` — connects to `CHAIN_RPC_URL` with `DEPLOYER_PRIVATE_KEY` and pre-deployed
  contract addresses (no auto-deploy). The deployer key acts as Requester + operator;
  Workers are a separate mnemonic-derived pool (`VERITAS_WORKER_MNEMONIC`), funded lazily
  from the deployer.

### Verified on Arc testnet

Settlement is live on **Arc testnet (chainId 5042002)**, not just local anvil. Deployed:

- MockUSDC `0x73544D772f4122Fe326115b57899DC020cf3B9d6`
- ReputationRegistry `0x234c1287B7F589eCE430ccaAdC2d30e0CBe5968e`
- TaskEscrow `0x925DE1312aeA15C1af1bEfe262b0BBAF3e7A208a`

A 5-Worker Round settled in one real `settle` tx
`0xb904a61c73163c088d0c9693abb0a1837de08ad6443f92a5cd1055d4985d92c2` (success, block
47288941). Real on-chain effects: USDC payouts (an honest Worker received +23.2 USDC =
baseReward 5 × numTasks 8 × normalized 0.580), Stake returned, and the Worker's new
reputation written on-chain (0.398 on the 1e6 scale).

## Consequences

- **First real money movement.** The dashboard's Live-server mode now shows real tx hashes,
  an `on-chain · <chainId>` provenance chip, and real USDC balance deltas — alongside the
  existing `x402 · access paid` boundary gate (ADR-0008). The Circle feed is no longer chrome.
- **Arc testnet is the same settlement code as `local`.** `CHAIN_MODE=testnet` + RPC +
  contract addresses is all that differs; the settlement code is identical. Two testnet
  realities surfaced and are resolved (commit 4930994): (1) Arc, a regulated Circle chain,
  blocks anvil's well-known public keys as transaction senders, so testnet Workers are
  derived from a separate project mnemonic (`VERITAS_WORKER_MNEMONIC`) and funded lazily from
  the deployer (gas top-up + open MockUSDC mint), idempotent via balance checks; (2) the
  off-chain runner restarts `roundId` at 0 each boot, so on-chain round ids are namespaced by
  a per-process base to avoid `RoundExists` on a persistent chain.
- **The contract is a settlement *checker*, not a re-scorer.** It trusts the operator for the
  CA scores (verifiable-not-trusted, ADR-0001) but independently enforces conservation and
  the slash/redistribution rules, so a buggy or malicious operator cannot create or destroy
  USDC — only mis-rank within a conserving settlement, which the published inputs expose.
- **On-chain void returns all Stake.** Unlike the off-chain model (which slashes
  commit-no-reveal even on a sub-Quorum void), the on-chain void path refunds every committed
  Worker's Stake in full: a sub-Quorum Round produced no scorable grid, so nothing is
  forfeited. Documented divergence, intentional.
- Foundry tests (9) cover the contract math; the server's `chain.test.ts` (2) verify the
  full open→commit→reveal→settle and the slash path against a real anvil.
