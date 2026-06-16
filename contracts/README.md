# Veritas on-chain settlement layer

Foundry contracts that make a Veritas Round really settle on an EVM chain (local anvil now;
Arc / EVM testnet via env later). The off-chain Scorer computes Correlated Agreement; these
contracts hold the money, enforce the [settlement math](../packages/core/src/settlement.ts),
and conserve every unit of USDC (ADR-0001: inputs on-chain, results submitted, anyone can
recompute — verifiable, not trusted). The optimistic-challenge path is out of scope.

## Contracts

| Contract | Role |
| --- | --- |
| `MockUSDC` | 6-decimals ERC-20 USDC stand-in with an open `mint` for local/testnet funding. |
| `ReputationRegistry` | ERC-8004-style signed reputation store (1e6 raw-CA scale, may be negative). Only the escrow writes it. |
| `TaskEscrow` | ERC-8183-style escrow running the Round lifecycle (open → commit → reveal → settle/void). |

## Round lifecycle

1. **openRound** — Requester locks Escrow = `baseReward × numTasks × maxWorkers` (the maximum
   payout, when all M Workers score a perfect 1.0). Requester must `approve` the escrow first.
2. **joinAndCommit** — each Worker posts `stakeAmount` and `commit = keccak256(abi.encode(answer, salt))`.
   Open-join in this version; Assignment and the reputable-majority floor (ADR-0005) are
   enforced off-chain by the operator, which scores only the assigned set.
3. **reveal** — after committing, Worker submits `(answer, salt)`; verified against the commit.
4. **settle** — operator-only, after off-chain CA scoring. Enforces:
   - reward = `baseReward × numTasks × normalizedBps / 10000`, drawn from Escrow
   - sub-threshold (slashed) Worker forfeits **50%** of Stake; **committed-but-not-revealed
     forfeits 100%** (enforced on-chain from reveal state, regardless of the `slashed` input)
   - slashed Stake is redistributed in **equal shares** to honest (revealed, non-slashed) Workers
   - with no honest Worker, orphaned Stake → **treasury**, never the Requester (ADR-0007);
     integer-division dust also goes to treasury
   - Requester refunded `escrow − totalPayouts`
   - reverts unless `escrow + Σstake == Σpayout + ΣstakeReturned + Σredistribution + requesterRefund + treasury`
   - below Quorum (< 3 revealing Workers) → auto-routes to the **void** path
5. **void** — sub-Quorum Round: full Escrow refund, all Stake returned, no slash, no reputation
   change. (On-chain void returns Stake to non-revealers too, since no scorable grid existed.)

## Function signatures the server calls

```solidity
// MockUSDC
function mint(address to, uint256 amount) external;
function approve(address spender, uint256 amount) external returns (bool); // standard ERC-20
function balanceOf(address) external view returns (uint256);
function decimals() external pure returns (uint8); // 6

// TaskEscrow — lifecycle
function openRound(uint256 roundId, uint256 baseReward, uint256 stakeAmount, uint256 numTasks, uint256 maxWorkers) external;
function joinAndCommit(uint256 roundId, bytes32 commitHash) external;
function reveal(uint256 roundId, bytes32 answer, bytes32 salt) external;
function settle(uint256 roundId, address[] workers, uint256[] normalizedBps, bool[] slashed, int256[] reputationDeltas) external; // operator only
function void(uint256 roundId) external; // operator only

// TaskEscrow — admin / views
function setOperator(address) external; // owner
function setTreasury(address) external; // owner
function getRound(uint256 roundId) external view returns (
    address requester, uint256 baseReward, uint256 stakeAmount, uint256 numTasks,
    uint256 maxWorkers, uint256 escrow, uint256 stakePool, uint256 revealedCount,
    RoundState state, uint256 workerCount); // RoundState: 0=None,1=Open,2=Settled,3=Voided
function getWorkers(uint256 roundId) external view returns (address[]);
function getParticipant(uint256 roundId, address worker) external view returns (bool committed, bool revealed, bytes32 commitHash, bytes32 answer);

// ReputationRegistry
function setAuthorizedWriter(address) external; // owner; set to the TaskEscrow address
function reputationOf(address worker) external view returns (int256); // 1e6 scale
function tierOf(address worker) external view returns (Tier); // 0=Ineligible,1=Probation,2=Standard,3=Premium
function isProven(address worker) external view returns (bool);
```

`commitHash` = `keccak256(abi.encode(answer, salt))` where `answer` and `salt` are `bytes32`
(viem: `keccak256(encodeAbiParameters([{type:'bytes32'},{type:'bytes32'}], [answer, salt]))`).
`normalizedBps[i]` ∈ [0, 10000] (10000 = 1.0). `reputationDeltas[i]` is the **new absolute**
reputation in 1e6 scale (the off-chain EMA result), not a delta.

## Events the server listens to

```solidity
// TaskEscrow
event RoundOpened(uint256 indexed roundId, address indexed requester, uint256 baseReward, uint256 stakeAmount, uint256 numTasks, uint256 maxWorkers, uint256 escrow);
event Committed(uint256 indexed roundId, address indexed worker, bytes32 commitHash);
event Revealed(uint256 indexed roundId, address indexed worker, bytes32 answer);
event Slashed(uint256 indexed roundId, address indexed worker, uint256 amount, bool fullSlash);
event PayoutSettled(uint256 indexed roundId, address indexed worker, uint256 reward, uint256 stakeReturned, uint256 redistribution);
event Settled(uint256 indexed roundId, uint256 totalPayouts, uint256 totalRedistributed, uint256 treasuryAmount, uint256 requesterRefund);
event Voided(uint256 indexed roundId, uint256 escrowRefunded, uint256 stakeReturned);

// ReputationRegistry
event ReputationUpdated(address indexed worker, int256 oldReputation, int256 newReputation);
```

## Build, test, deploy

```bash
forge build
forge test -vv

# Local: start anvil, then deploy with the default funded key.
anvil &
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

### Deploy env

The deploy script (`script/Deploy.s.sol`) reads:

| Env | Default | Meaning |
| --- | --- | --- |
| `PRIVATE_KEY` | anvil account #0 | deployer key |
| `OPERATOR` | deployer | off-chain Scorer/operator (settle/void caller) |
| `TREASURY` | deployer | protocol treasury for orphaned slashed Stake |
| `MINT_RECIPIENTS` | deployer + anvil #1..#3 | comma-separated addresses to fund with MockUSDC |
| `MINT_AMOUNT` | `1000000e6` (1M USDC) | per-recipient mint amount |

### Deploying to Arc / an EVM testnet

```bash
PRIVATE_KEY=0x<funded-key> OPERATOR=0x<scorer> TREASURY=0x<treasury> \
forge script script/Deploy.s.sol --rpc-url <TESTNET_RPC_URL> --broadcast
```

You need only **a funded private key** and an **RPC URL**. On a real chain, point `TaskEscrow`
at the canonical USDC instead of `MockUSDC` (deploy `ReputationRegistry` + `TaskEscrow` with the
real USDC address; skip the MockUSDC deploy and the local mint loop).

## Integration artifacts

`exports/{MockUSDC,ReputationRegistry,TaskEscrow}.json` are committed `{ abi, bytecode }`
files (the gitignored `out/` is not relied on). `exports/index.ts` re-exports them typed for
the server to deploy via viem on boot. Regenerate after contract changes — see `index.ts`.
