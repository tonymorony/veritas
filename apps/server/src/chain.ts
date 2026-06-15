/**
 * The `ChainSettler` seam — real on-chain settlement for a Veritas Round.
 *
 * The off-chain round runner (`packages/agents`) computes the canonical `RoundResult`:
 * Correlated-Agreement scores, normalized payouts, slashes and post-round reputations. This
 * module takes that finished result and replays the REAL escrow lifecycle on an EVM chain via
 * viem — open → commit → reveal → settle — so the money actually moves and the response carries
 * real tx hashes (ADR-0001: inputs on-chain, results submitted, anyone can recompute).
 *
 * Modes (see `config.chainMode`):
 *  - `local`   — connect viem to the RPC and, on first use, DEPLOY the three contracts from
 *                `contracts/exports` (MockUSDC → ReputationRegistry → TaskEscrow, wiring the
 *                registry's authorized writer to the escrow), funding anvil's deterministic
 *                accounts. Requester = acct 0, Workers = accts 1..N, operator = acct 0.
 *  - `testnet` — connect to `chainRpcUrl` with `deployerPrivateKey` and pre-deployed addresses
 *                (no auto-deploy). The deployer also acts as Requester/operator; Workers are
 *                derived from the same mnemonic is NOT available here, so testnet uses the
 *                single deployer key for the on-chain participants (sufficient for a demo —
 *                production would fund per-worker keys).
 *
 * Unit reconciliation: `baseReward`/`stake` in RoundParams are small whole-USDC integers; on
 * chain they are scaled by 1e6 (USDC has 6 decimals). Escrow size = baseReward·numTasks·maxWorkers.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeAbiParameters,
  keccak256,
  parseEther,
  toHex,
  type PublicClient,
  type WalletClient,
  type Account,
  type Address,
  type Hex,
} from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { MockUSDC, ReputationRegistry, TaskEscrow } from "../../../contracts/exports/index";
import type { RoundResult } from "@x402-plays/agents";
import type { ServerConfig } from "./config";

/** Anvil's canonical deterministic mnemonic. */
const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";
const USDC_SCALE = 1_000_000n; // 6 decimals
const REPUTATION_SCALE = 1_000_000n; // 1e6, matches on-chain reputation scale
const BPS_SCALE = 10_000n;
/** Generous per-account funding for the local demo. */
const LOCAL_MINT = 1_000_000n * USDC_SCALE; // 1M USDC

interface Deployment {
  chainId: number;
  usdc: Address;
  reputation: Address;
  escrow: Address;
}

/** A signer plus its viem wallet client, bound to one account. */
interface Signer {
  account: Account;
  wallet: WalletClient;
}

export class ChainSettler {
  private readonly config: ServerConfig;
  private publicClient!: PublicClient;
  private deployment?: Deployment;
  private requester!: Signer;
  private operator!: Signer;
  /** Worker signer pool, indexed; assigned workers map onto these by position. */
  private workerSigners: Signer[] = [];
  private initPromise?: Promise<void>;
  /**
   * Per-process base for on-chain Round ids. The off-chain runner restarts `roundId` at 0 each
   * boot, but on a persistent testnet a re-used id reverts with RoundExists; namespacing by the
   * process start time keeps ids unique across restarts.
   */
  private readonly roundIdBase: bigint;

  constructor(config: ServerConfig) {
    this.config = config;
    this.roundIdBase = config.chainMode === "testnet" ? BigInt(Date.now()) * 1_000n : 0n;
  }

  /** Idempotent: connect (and for `local`, deploy + fund) exactly once. */
  async init(): Promise<void> {
    if (this.config.chainMode === "off") return;
    if (!this.initPromise) this.initPromise = this.doInit();
    return this.initPromise;
  }

  private makeSigner(account: Account): Signer {
    return {
      account,
      wallet: createWalletClient({ account, transport: http(this.config.chainRpcUrl) }),
    };
  }

  private async doInit(): Promise<void> {
    const transport = http(this.config.chainRpcUrl);
    this.publicClient = createPublicClient({ transport }) as PublicClient;
    const chainId = await this.publicClient.getChainId();

    if (this.config.chainMode === "local") {
      // Deterministic anvil accounts: 0 = Requester/operator, 1..N = Workers. anvil pre-funds
      // them all with gas; fundLocal mints them USDC.
      this.requester = this.makeSigner(mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 0 }));
      this.operator = this.requester;
      this.workerSigners = Array.from({ length: 16 }, (_, i) =>
        this.makeSigner(mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: i + 1 })),
      );
      this.deployment = await this.deployLocal(chainId);
      await this.fundLocal();
      return;
    }

    // testnet: a real funded deployer is Requester + operator; the mnemonic Workers above are
    // funded lazily per Round (gas + MockUSDC) from the deployer.
    if (!this.config.deployerPrivateKey) {
      throw new Error("CHAIN_MODE=testnet requires DEPLOYER_PRIVATE_KEY");
    }
    const { usdc, reputation, escrow } = this.config.chainAddresses;
    if (!usdc || !reputation || !escrow) {
      throw new Error(
        "CHAIN_MODE=testnet requires CHAIN_USDC_ADDRESS, CHAIN_REPUTATION_ADDRESS and CHAIN_ESCROW_ADDRESS",
      );
    }
    const deployer = this.makeSigner(privateKeyToAccount(this.config.deployerPrivateKey as Hex));
    this.requester = deployer;
    this.operator = deployer;
    // Workers come from a project mnemonic (NOT anvil's — Arc blocks those public keys as
    // senders). Fresh addresses, funded from the deployer per Round in ensureTestnetFunding.
    this.workerSigners = Array.from({ length: 16 }, (_, i) =>
      this.makeSigner(mnemonicToAccount(this.config.workerMnemonic, { addressIndex: i })),
    );
    this.deployment = {
      chainId,
      usdc: usdc as Address,
      reputation: reputation as Address,
      escrow: escrow as Address,
    };
  }

  /**
   * Top up the assigned testnet Workers from the deployer so they can pay gas and post Stake.
   * Idempotent: each Worker is funded only when its native or USDC balance runs low, so repeat
   * Rounds skip funding entirely. MockUSDC's `mint` is open, so the deployer mints to each.
   */
  private async ensureTestnetFunding(workers: Address[], stakeAmount: bigint): Promise<void> {
    const d = this.deployment!;
    const GAS_MIN = parseEther("0.05");
    const GAS_TOPUP = parseEther("0.3");
    const usdcMin = stakeAmount * 4n;
    const usdcTopup = stakeAmount * 20n + 1_000n * USDC_SCALE;
    for (const w of workers) {
      const gas = await this.publicClient.getBalance({ address: w });
      if (gas < GAS_MIN) {
        const hash = await this.requester.wallet.sendTransaction({
          account: this.requester.account,
          to: w,
          value: GAS_TOPUP,
          chain: null,
        });
        await this.publicClient.waitForTransactionReceipt({ hash });
      }
      if ((await this.usdcBalance(w)) < usdcMin) {
        const hash = await this.requester.wallet.writeContract({
          address: d.usdc,
          abi: MockUSDC.abi,
          functionName: "mint",
          args: [w, usdcTopup],
          account: this.requester.account,
          chain: null,
        });
        await this.publicClient.waitForTransactionReceipt({ hash });
      }
    }
  }

  /** Deploy the three contracts and wire the registry's authorized writer to the escrow. */
  private async deployLocal(chainId: number): Promise<Deployment> {
    const deployer = this.requester;
    const owner = deployer.account.address;

    const usdc = await this.deploy(deployer, MockUSDC.abi, MockUSDC.bytecode, []);
    const reputation = await this.deploy(deployer, ReputationRegistry.abi, ReputationRegistry.bytecode, [
      owner,
    ]);
    const escrow = await this.deploy(deployer, TaskEscrow.abi, TaskEscrow.bytecode, [
      usdc,
      reputation,
      this.operator.account.address, // operator
      owner, // treasury
      owner, // owner
    ]);
    // Authorize the escrow to write reputation.
    const writerTx = await deployer.wallet.writeContract({
      address: reputation,
      abi: ReputationRegistry.abi,
      functionName: "setAuthorizedWriter",
      args: [escrow],
      account: deployer.account,
      chain: null,
    });
    await this.publicClient.waitForTransactionReceipt({ hash: writerTx });

    return { chainId, usdc, reputation, escrow };
  }

  /** Deploy a single contract, return its address. */
  private async deploy(
    signer: Signer,
    abi: readonly unknown[],
    bytecode: Hex,
    args: unknown[],
  ): Promise<Address> {
    const hash = await signer.wallet.deployContract({
      abi,
      bytecode,
      args,
      account: signer.account,
      chain: null,
    } as never);
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) throw new Error("deploy: no contractAddress in receipt");
    return receipt.contractAddress;
  }

  /** Mint MockUSDC to the Requester and every worker signer. */
  private async fundLocal(): Promise<void> {
    const d = this.deployment!;
    const recipients = [this.requester.account.address, ...this.workerSigners.map((s) => s.account.address)];
    for (const to of recipients) {
      const hash = await this.requester.wallet.writeContract({
        address: d.usdc,
        abi: MockUSDC.abi,
        functionName: "mint",
        args: [to, LOCAL_MINT],
        account: this.requester.account,
        chain: null,
      });
      await this.publicClient.waitForTransactionReceipt({ hash });
    }
  }

  /** USDC balance (6-decimals raw) for an address. Exposed for verification/tests. */
  async usdcBalance(address: Address): Promise<bigint> {
    const d = this.deployment!;
    return (await this.publicClient.readContract({
      address: d.usdc,
      abi: MockUSDC.abi,
      functionName: "balanceOf",
      args: [address],
    })) as bigint;
  }

  /** The deployed contract addresses (after init). */
  addresses(): Deployment {
    if (!this.deployment) throw new Error("ChainSettler not initialized");
    return this.deployment;
  }

  /** The anvil address backing assigned-worker slot `i`. */
  workerAddress(i: number): Address {
    const signer = this.workerSigners[i % this.workerSigners.length]!;
    return signer.account.address;
  }

  /**
   * Replay an already-computed Round on chain and return the result enriched with REAL tx
   * hashes (in `txs[].hash`) and a `chain` field. A refused/void Round routes to `void`.
   */
  async settleOnChain(result: RoundResult): Promise<RoundResult> {
    await this.init();
    if (this.config.chainMode === "off") return result;
    const d = this.deployment!;

    const p = result.params;
    const baseReward = BigInt(p.baseReward) * USDC_SCALE;
    const stakeAmount = BigInt(p.stake) * USDC_SCALE;
    const numTasks = BigInt(p.numTasks);
    // maxWorkers must cover the assigned set; the contract sizes escrow as
    // baseReward·numTasks·maxWorkers.
    const maxWorkers = BigInt(Math.max(result.assigned.length, 1));
    const roundId = this.roundIdBase + BigInt(result.roundId);

    // Map each assigned worker (by position) to a mnemonic signer address.
    const workerAddrs = result.assigned.map((_w, i) => this.workerAddress(i));

    // On testnet the mnemonic Workers start empty — top them up (gas + USDC) before they stake.
    if (this.config.chainMode === "testnet" && workerAddrs.length > 0) {
      await this.ensureTestnetFunding(workerAddrs, stakeAmount);
    }

    // Refused / void path: nothing was scored, just void with a fresh open if needed.
    if (result.refused) {
      // Open with the assigned set so void can refund; if no assigned set, skip the chain leg.
      if (result.assigned.length === 0) {
        return { ...result, chain: { chainId: d.chainId, addresses: this.addressMap() } };
      }
    }

    // 1. Requester approves the escrow for the full max payout, then opens the round.
    const escrowTotal = baseReward * numTasks * maxWorkers;
    await this.approve(this.requester, d.escrow, escrowTotal);
    await this.write(this.requester, d.escrow, TaskEscrow.abi, "openRound", [
      roundId,
      baseReward,
      stakeAmount,
      numTasks,
      maxWorkers,
    ]);

    // 2. Each assigned worker stakes (approve) then joinAndCommit, then reveals.
    //    The committed value is a digest of the worker's report row + a per-worker salt — the
    //    on-chain commit-reveal is the anti-front-running / liveness proof; the CA scores come
    //    from the operator at settle time.
    const reveal: { answer: Hex; salt: Hex }[] = [];
    for (let i = 0; i < result.assigned.length; i++) {
      const w = result.assigned[i]!;
      const signer = this.workerSigners[i % this.workerSigners.length]!;
      const row = (result.grid[w.id] ?? []).join("|");
      const answer = keccak256(toHex(`${w.id}:${row}`)); // bytes32
      const salt = keccak256(toHex(`salt:${result.roundId}:${w.id}`)); // bytes32
      const commitHash = keccak256(
        encodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }], [answer, salt]),
      );
      await this.approve(signer, d.escrow, stakeAmount);
      await this.write(signer, d.escrow, TaskEscrow.abi, "joinAndCommit", [roundId, commitHash]);
      reveal.push({ answer, salt });
    }

    if (result.refused) {
      // Quorum / floor failure → operator voids: full refund, all stake returned, no slash.
      const voidTx = await this.write(this.operator, d.escrow, TaskEscrow.abi, "void", [roundId]);
      return {
        ...result,
        chain: { chainId: d.chainId, addresses: this.addressMap(), settleTx: voidTx },
      };
    }

    // Reveal each commit (required before settle for non-slashed payout).
    for (let i = 0; i < result.assigned.length; i++) {
      const signer = this.workerSigners[i % this.workerSigners.length]!;
      const { answer, salt } = reveal[i]!;
      await this.write(signer, d.escrow, TaskEscrow.abi, "reveal", [roundId, answer, salt]);
    }

    // 3. Operator settles with normalizedBps / slashed / new absolute reputations.
    const scoreByWorker = new Map(result.scores.map((s) => [s.worker, s] as const));
    const repByWorker = new Map(result.assigned.map((w) => [w.id, w.reputation] as const));
    const normalizedBps: bigint[] = [];
    const slashed: boolean[] = [];
    const reputationDeltas: bigint[] = [];
    for (const w of result.assigned) {
      const s = scoreByWorker.get(w.id);
      const bps = clampBps(s ? s.normalized : 0);
      normalizedBps.push(bps);
      slashed.push(s ? s.slashed : true);
      const rep = repByWorker.get(w.id) ?? 0;
      reputationDeltas.push(BigInt(Math.round(rep * Number(REPUTATION_SCALE))));
    }

    const settleTx = await this.write(this.operator, d.escrow, TaskEscrow.abi, "settle", [
      roundId,
      workerAddrs,
      normalizedBps,
      slashed,
      reputationDeltas,
    ]);

    // 4. Swap real tx hashes into the result. The existing `txs[]` are per-paid-worker; map each
    //    back to its on-chain payout by worker id. Settlement is one `settle` tx on chain, so we
    //    attribute the settle tx hash to each paid worker's payout (the demo's Circle feed shows
    //    real hashes; per-worker payout tx granularity is a nice-to-have, kept simple here).
    const txs = result.txs.map((tx) => ({ ...tx, hash: settleTx }));

    return {
      ...result,
      txs,
      chain: {
        chainId: d.chainId,
        addresses: this.addressMap(),
        settleTx,
      },
    };
  }

  private addressMap(): Record<string, string> {
    const d = this.deployment!;
    return { usdc: d.usdc, reputation: d.reputation, escrow: d.escrow };
  }

  private async approve(signer: Signer, spender: Address, amount: bigint): Promise<Hex> {
    return this.write(signer, this.deployment!.usdc, MockUSDC.abi, "approve", [spender, amount]);
  }

  /** Send a contract write from `signer` and wait for the receipt; returns the tx hash. */
  private async write(
    signer: Signer,
    address: Address,
    abi: readonly unknown[],
    functionName: string,
    args: unknown[],
  ): Promise<Hex> {
    const hash = await signer.wallet.writeContract({
      address,
      abi,
      functionName,
      args,
      account: signer.account,
      chain: null,
    } as never);
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }
}

/** Clamp a normalized [0,1] score to integer basis points in [0, 10000]. */
function clampBps(normalized: number): bigint {
  const bps = Math.round(normalized * Number(BPS_SCALE));
  if (bps <= 0) return 0n;
  if (bps >= Number(BPS_SCALE)) return BPS_SCALE;
  return BigInt(bps);
}

/** Lazily-constructed singleton, so deployment is cached for the process lifetime. */
let singleton: ChainSettler | undefined;
export function getChainSettler(config: ServerConfig): ChainSettler {
  if (!singleton) singleton = new ChainSettler(config);
  return singleton;
}

/** Test hook: drop the cached settler so a fresh anvil gets a fresh deployment. */
export function resetChainSettler(): void {
  singleton = undefined;
}
