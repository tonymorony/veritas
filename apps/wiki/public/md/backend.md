# Backend & API

Everything in the [demo guide](/guide-demo) runs in the browser. But Veritas also ships a **real backend** — an HTTP service that runs the *same* mechanism with *real* worker-agents behind a *real* x402 payment gate. This page documents that server: its architecture, its HTTP API, the x402 gate, and the worker-agent engine. It is the reference behind [ADR-0008](/architecture#adr-0008).

> **Run it:** the companion guide [Run it live](/guide-live) walks you through starting the server, flipping the dashboard to **Live server** mode, and going fully live with real LLMs and real settlement.

## Two ways to run the mechanism

The dashboard has two interchangeable engines for producing a [Round](/core-concepts#round):

- **In-browser simulation** (default) — the whole [Round](/core-concepts#round) lifecycle runs client-side. Zero setup; nothing to start. This is what the [demo guide](/guide-demo) describes.
- **Live server** (`apps/server`) — an Express service that runs each Round through the identical `@x402-plays/core` mechanism, in memory, and returns the result over HTTP.

The crucial property: **both paths call the same core.** The server doesn't reimplement scoring — it imports `scoreRound`, `settleRound`, `applyRound`, and `assignWorkers` from [`@x402-plays/core`](/api) exactly as the browser does, and holds the marketplace state (persistent Worker [Reputation](/core-concepts#reputation), round count) in process memory. Flipping the toggle changes *where* the mechanism runs, never *what* it computes. The server's `POST /api/round` returns a `RoundResult` that is byte-compatible with the browser's, so the dashboard renders it unchanged.

## The HTTP API

The server exposes five endpoints. The two that produce or read settled work — `POST /api/round` and `GET /api/leaderboard` — sit behind the [x402 gate](#the-x402-gate); the rest are open.

### `GET /health`

Liveness. Returns `{ ok: true, engine, x402Mode }` — handy for confirming which [engine](#the-worker-agent-engine) and [gate mode](#the-x402-gate) the server booted with.

### `GET /api/state`

The current marketplace: every Worker with its `reputation` and `tier`, the cumulative `roundCount`, and the active `engine` / `x402Mode`. Open (no payment).

### `POST /api/round`

Runs one Round and returns a **`RoundResult`** (the [same shape](/api#core-types) the dashboard renders: assignment, the worker×task grid, scores, settlement, mock Circle transactions, the leaderboard, the truth-match and inversion flags, and `engineUsed`). **x402-gated.**

Request body — all fields optional:

```jsonc
{
  "params": { /* RoundParams: numTasks, roundSize, baseReward, stake,
                 honestAccuracy, sybilTarget, sybilStrategy,
                 enforceMajorityFloor, seed — each merged over server defaults */ },
  "composition": { "honest": 4, "reference": 2, "sloppy": 1, "sybil": 0 },
  "engine": "live"   // per-request override; defaults to the server's configured engine
}
```

`params` is shallow-merged over the server's defaults, so you can send just the knobs you want to change. `composition` rebuilds the swarm (preserving the Reputation of surviving Workers); omit it to keep the current swarm. `engine` overrides the configured [engine](#the-worker-agent-engine) for this one Round.

### `POST /api/reset`

Resets all Reputations and the round count, rebuilding the swarm. Accepts an optional `{ composition }`. Open (no payment).

### `GET /api/leaderboard`

The latest cumulative [Leaderboard](/core-concepts#leaderboard) plus `roundCount`. **x402-gated** — pulling results is a paid action, matching x402's "pay to use a service" shape ([ADR-0003](/architecture#adr-0003)).

CORS is enabled for the dashboard origins (`localhost:5173` and `:4173`), and `X-Payment-Response` is exposed so the browser can read the settlement header from the [gate](#the-x402-gate).

## The x402 gate

The gated endpoints enforce an **x402** HTTP-402 payment at the API boundary ([ADR-0003](/architecture#adr-0003)). The gate has three modes, set by `X402_MODE`:

| Mode | Behavior |
|---|---|
| `off` | Open — the gate is a pass-through. |
| `mock` *(default)* | A **real 402 handshake**: a request with no `X-PAYMENT` header gets a spec-shaped HTTP `402` with a payment-requirements body (`accepts`: scheme, network, amount, `payTo`, asset…); any request *with* an `X-PAYMENT` header is accepted as settled and gets an `X-Payment-Response` header back. |
| `live` | Real [`x402-express`](https://www.npmjs.com/package/x402-express) middleware against a facilitator. Needs `X402_PAY_TO`, a facilitator URL, and a funded wallet on the network. |

**`mock` is the default** — and it is not a no-op. It performs the genuine 402 challenge/response over the wire (priced at `$0.01` USDC on `base-sepolia`), which the dashboard auto-pays by attaching an `X-PAYMENT` header. That makes the x402 integration *visibly functional* in the demo with zero wallet setup: you see the 402, then the settled response. The only thing mocked is the payment's on-chain validity. `live` swaps in the real middleware and verifies the payment against the facilitator; the live gate is constructed lazily, so a misconfigured wallet fails the *request*, not server startup.

## The worker-agent engine

Where the browser sim always models its swarm, the server can produce judgments from **real LLMs**. Two engines, set by `VERITAS_ENGINE` (or per-request via the `engine` body field):

- **`simulated`** *(default)* — the deterministic latent-truth swarm, identical to the browser demo. Every archetype (honest, reference, sloppy, sybil) is modelled.
- **`live`** — honest and Reference Workers get their judgments from **real LLM calls**, round-robined across whichever providers have API keys: **Anthropic, OpenAI, and Google**. Using three distinct model families is deliberate — it satisfies the [swarm-heterogeneity requirement](/architecture#adr-0002) (CA needs genuinely diverse honest signals, not one base model in different costumes). Sloppy and Sybil archetypes stay modelled, because you can't reliably ask an LLM to be lazy or to collude on a pre-agreed decoy.

**Graceful fallback.** If `live` is requested but *no* provider keys are configured, the engine falls back to `simulated` so the demo always runs. The `RoundResult.engineUsed` field reports what *actually* happened — `"live"` only when at least one real provider ran, otherwise `"simulated"`. The dashboard surfaces this as the **server · live** / **server · simulated** chip, so you always know whether you watched real model calls or the model.

Malformed LLM responses never break a Round: each adapter parses the model's free-form text down to a valid [answer](/core-concepts#report) label (earliest-mentioned option wins), and falls back to a random valid label if parsing fails or the call throws.

See it end to end in [Run it live](/guide-live), and the decision record in [ADR-0008](/architecture#adr-0008).
