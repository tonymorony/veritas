import type { RoundParams, RoundResult, SwarmComposition } from "./types";

/** The real Veritas backend (apps/server). Override via VITE_SERVER_URL. */
export const SERVER_URL =
  (import.meta.env.VITE_SERVER_URL as string | undefined) ?? "http://localhost:8787";

/** The server may report which engine actually ran (live LLMs vs simulated fallback). */
export type ServerRoundResult = RoundResult & { engineUsed?: "live" | "simulated" };

export interface ServerState {
  ok: boolean;
  engineUsed?: "live" | "simulated";
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // satisfies the x402 gate in `mock` mode; ignored in `off`, real-signed in `live`
      "x-payment": "demo",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 402) {
    throw new Error("402 Payment Required — x402 gate is live (configure a wallet to pay)");
  }
  if (!res.ok) throw new Error(`server ${res.status}: ${await res.text().catch(() => "")}`);
  return (await res.json()) as T;
}

export async function pingServer(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

export function runRoundLive(
  params: RoundParams,
  composition: SwarmComposition,
): Promise<ServerRoundResult> {
  return post<ServerRoundResult>("/api/round", { params, composition });
}

export function resetServer(): Promise<void> {
  return post<void>("/api/reset", {});
}
