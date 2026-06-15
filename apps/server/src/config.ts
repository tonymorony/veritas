/** All server config is read from env, with demo-safe defaults so it boots with zero setup. */
import type { Engine } from "@x402-plays/agents";

export type X402Mode = "off" | "mock" | "live";

export interface ServerConfig {
  port: number;
  x402Mode: X402Mode;
  payTo: string;
  facilitatorUrl: string;
  engine: Engine;
  corsOrigins: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const x402Mode = (env.X402_MODE ?? "off") as X402Mode;
  const engine = (env.VERITAS_ENGINE ?? "simulated") as Engine;
  return {
    port: Number(env.PORT ?? 8787),
    x402Mode: ["off", "mock", "live"].includes(x402Mode) ? x402Mode : "off",
    payTo: env.X402_PAY_TO ?? "0x0000000000000000000000000000000000000000",
    facilitatorUrl: env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
    engine: engine === "live" ? "live" : "simulated",
    corsOrigins: ["http://localhost:5173", "http://localhost:4173"],
  };
}
