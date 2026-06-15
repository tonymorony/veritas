/** All server config is read from env, with demo-safe defaults so it boots with zero setup. */
import type { Engine } from "@x402-plays/agents";

export type X402Mode = "off" | "mock" | "live";

/**
 * On-chain settlement mode (the `ChainSettler` seam):
 *  - `off`     — no chain; keep today's mock tx hashes (default, zero-setup demo).
 *  - `local`   — viem against a local anvil; auto-deploy the three contracts on first use.
 *  - `testnet` — viem against `chainRpcUrl` with `deployerPrivateKey` and pre-deployed addresses.
 */
export type ChainMode = "off" | "local" | "testnet";

export interface ChainAddresses {
  usdc?: string;
  reputation?: string;
  escrow?: string;
}

export interface ServerConfig {
  port: number;
  x402Mode: X402Mode;
  payTo: string;
  facilitatorUrl: string;
  engine: Engine;
  corsOrigins: string[];
  chainMode: ChainMode;
  chainRpcUrl: string;
  /** Funded deployer/signer key for testnet mode (hex, 0x-prefixed). */
  deployerPrivateKey?: string;
  /** Pre-deployed contract addresses for testnet mode. */
  chainAddresses: ChainAddresses;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  // Default to `mock`: the x402 gate performs a real 402 challenge/response handshake on
  // each gated request (the dashboard auto-pays via header), so the Circle/x402 integration
  // is visibly functional in the demo. Set X402_MODE=off to disable, or =live for real settlement.
  const x402Mode = (env.X402_MODE ?? "mock") as X402Mode;
  const engine = (env.VERITAS_ENGINE ?? "simulated") as Engine;
  // Default to `off`: keeps today's mock txs so the demo runs with zero setup.
  const chainMode = (env.CHAIN_MODE ?? "off") as ChainMode;
  return {
    port: Number(env.PORT ?? 8787),
    x402Mode: ["off", "mock", "live"].includes(x402Mode) ? x402Mode : "off",
    payTo: env.X402_PAY_TO ?? "0x0000000000000000000000000000000000000000",
    facilitatorUrl: env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
    engine: engine === "live" ? "live" : "simulated",
    corsOrigins: ["http://localhost:5173", "http://localhost:4173"],
    chainMode: ["off", "local", "testnet"].includes(chainMode) ? chainMode : "off",
    chainRpcUrl: env.CHAIN_RPC_URL ?? "http://localhost:8545",
    deployerPrivateKey: env.DEPLOYER_PRIVATE_KEY,
    chainAddresses: {
      usdc: env.CHAIN_USDC_ADDRESS,
      reputation: env.CHAIN_REPUTATION_ADDRESS,
      escrow: env.CHAIN_ESCROW_ADDRESS,
    },
  };
}
