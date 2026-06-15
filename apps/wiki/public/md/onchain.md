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

Testnet is a **config step, not a code change** — the settlement code is identical to `local`. Deploy the three contracts to Arc, then set:

```bash
CHAIN_MODE=testnet
CHAIN_RPC_URL=https://<arc-rpc-endpoint>
DEPLOYER_PRIVATE_KEY=0x...            # funded with testnet gas + USDC
CHAIN_USDC_ADDRESS=0x...              # canonical USDC on Arc
CHAIN_REPUTATION_ADDRESS=0x...
CHAIN_ESCROW_ADDRESS=0x...
```

For the demo the single deployer key acts as Requester, operator, and Worker participant; a production deployment would fund a key per Worker. That per-Worker funding is the one real gap between this demo and a production Arc deployment.

## How it's verified

Foundry tests (9) cover the contract math — payout, partial and full slash, equal-share redistribution, orphaned-slash-to-treasury, sub-Quorum void/refund, conservation, and access control. The server's `chain.test.ts` (2) drive the full `open → commit → reveal → settle` lifecycle and the slash path against a **real anvil**, asserting on real tx hashes, deployed addresses, and moved balances.

For the full rationale — including the one intentional divergence (the on-chain void returns *all* Stake, where the off-chain model slashes commit-no-reveal) — see [ADR-0009](/architecture).
