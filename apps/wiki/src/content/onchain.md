# On-chain settlement

The [x402 gate](/backend#the-x402-gate) makes *access* to a [Round](/core-concepts#round) a real payment. The **on-chain settlement layer** makes the [Settlement](/core-concepts#settlement) itself real: USDC actually moves between a Requester, Workers, and the treasury through Solidity contracts, and every Round returns verifiable transaction hashes. No mocked chrome — real escrow, real slashing, real balance deltas.

This is the layer that turns Veritas from "the same math, over the wire" into "the same math, on a chain anyone can audit." It implements [ADR-0009](/architecture).

## What's on chain (and what isn't)

Scoring stays **off-chain** — the heterogeneous LLM [swarm](/architecture#adr-0002) and the [Correlated Agreement](/correlated-agreement) scorer in [`@x402-plays/core`](/api) compute the canonical `RoundResult`. Only the *finished* result — normalized scores, slash flags, new reputations — is **submitted** on chain, where a contract enforces the arithmetic. This is the [verifiable-not-trusted](/architecture#adr-0001) split from ADR-0001: the chain is the settlement *checker*, not the re-scorer.

Three contracts (Foundry, in `contracts/`):

- **MockUSDC** — a 6-decimal ERC-20 stand-in for USDC locally. On testnet/mainnet the canonical USDC address is used instead — config, not code.
- **ReputationRegistry** (ERC-8004-style) — stores each [Worker's](/core-concepts#worker) absolute [Reputation](/core-concepts#reputation). The escrow is its single authorized writer.
- **TaskEscrow** (ERC-8183-style) — runs the on-chain Round lifecycle: `openRound → joinAndCommit → reveal → settle`, or `void` below [Quorum](/core-concepts#quorum).

`TaskEscrow` enforces — and *reverts* on any violation of — the exact settlement math of `packages/core/src/settlement.ts`:

- per-Report payout = `baseReward · numTasks · normalizedScore`, drawn from the Escrow;
- revealed-but-sub-threshold Workers forfeit **50%** of [Stake](/core-concepts#stake); committed-but-not-revealed forfeit **100%**;
- slashed Stake is redistributed in **equal shares** to honest Workers;
- with no honest Worker, orphaned slash goes to the **treasury**, never back to the Requester ([ADR-0007](/architecture));
- the Requester is refunded `escrow − totalPayouts`;
- and the whole thing reverts unless USDC is **exactly conserved**.

A buggy or malicious operator therefore cannot create or destroy USDC — only mis-rank within a conserving settlement, which the published inputs expose.

The on-chain `commit → reveal` is the anti-front-running / liveness proof; the scores still come from the off-chain scorer at `settle` time.

## Modes (`CHAIN_MODE`)

| Mode | What happens |
| --- | --- |
| `off` | No chain. The server returns mock tx hashes — the zero-config default. |
| `local` | viem connects to a local **anvil**; on the first Round the server deploys all three contracts to anvil's deterministic accounts, mints MockUSDC, and replays every Round as real transactions. The default "real on-chain" demo — no funded wallet or RPC needed. |
| `testnet` | viem connects to `CHAIN_RPC_URL` with `DEPLOYER_PRIVATE_KEY` and the pre-deployed contract addresses below. No auto-deploy. |

## Run the local on-chain demo

You need [Foundry](https://book.getfoundry.sh/) (`anvil`) on your path. In one terminal, start a local chain:

```bash
anvil
```

In another, start the [server](/backend) in `local` chain mode:

```bash
CHAIN_MODE=local pnpm -C apps/server dev
```

On the first Round the server deploys MockUSDC → ReputationRegistry → TaskEscrow to anvil (Requester/operator = account 0, Workers = accounts 1..N) and funds them. Then flip the dashboard to [Live server](/guide-live#step-2-flip-the-dashboard-to-live-server) and run a Round.

Watch the header: alongside **x402 · access paid** you now get an **on-chain · 31337** provenance chip (31337 is anvil's chain id), and the Circle settlement feed shows **real** transaction hashes. The USDC balances of the Requester, Workers, and treasury actually move — slashed Stake visibly flows to the honest Workers.

## Going to Arc testnet

This is **verified live, not theoretical**. The settlement layer ran a real Round on **Arc testnet (chainId 5042002)**, settled in one on-chain `settle` transaction. Testnet is the same settlement code as `local` — only RPC + contract addresses differ.

Deployed contracts (Arc testnet):

| Contract | Address |
| --- | --- |
| MockUSDC | `0x73544D772f4122Fe326115b57899DC020cf3B9d6` |
| ReputationRegistry | `0x234c1287B7F589eCE430ccaAdC2d30e0CBe5968e` |
| TaskEscrow | `0x925DE1312aeA15C1af1bEfe262b0BBAF3e7A208a` |

A 5-Worker Round settled in one `settle` tx `0xb904a61c73163c088d0c9693abb0a1837de08ad6443f92a5cd1055d4985d92c2` (success, block 47288941). Real effects on chain: USDC payouts (an honest Worker received **+23.2 USDC** = `baseReward 5 × numTasks 8 × normalized 0.580`), Stake returned, and the Worker's new [Reputation](/core-concepts#reputation) written on-chain (0.398 on the 1e6 scale).

Point the same code at Arc by setting:

```bash
CHAIN_MODE=testnet
CHAIN_RPC_URL=https://<arc-rpc-endpoint>
DEPLOYER_PRIVATE_KEY=0x...            # Requester + operator, funded with gas + USDC
VERITAS_WORKER_MNEMONIC="..."         # the Worker pool (see below)
CHAIN_USDC_ADDRESS=0x...              # canonical USDC on Arc
CHAIN_REPUTATION_ADDRESS=0x...
CHAIN_ESCROW_ADDRESS=0x...
```

Two testnet realities differ from `local` and shaped this setup:

- **Workers come from a project mnemonic, not anvil's keys.** Arc is a regulated Circle chain and blocks anvil's well-known public keys as transaction senders. So testnet Workers are derived from a separate `VERITAS_WORKER_MNEMONIC` instead of anvil's deterministic accounts.
- **Lazy per-Worker funding.** The deployer key acts as Requester + operator; each Worker is funded on demand from the deployer — a gas top-up plus an open MockUSDC mint, idempotent via balance checks so re-runs don't double-fund.
- **Round ids are namespaced.** The off-chain runner restarts `roundId` at 0 each boot, so on-chain round ids are offset by a per-process base to avoid `RoundExists` on a persistent chain.

## How it's verified

Foundry tests (9) cover the contract math — payout, partial and full slash, equal-share redistribution, orphaned-slash-to-treasury, sub-Quorum void/refund, conservation, and access control. The server's `chain.test.ts` (2) drive the full `open → commit → reveal → settle` lifecycle and the slash path against a **real anvil**, asserting on real tx hashes, deployed addresses, and moved balances.

For the full rationale — including the one intentional divergence (the on-chain void returns *all* Stake, where the off-chain model slashes commit-no-reveal) — see [ADR-0009](/architecture).
