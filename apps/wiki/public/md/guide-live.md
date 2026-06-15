# Guide: Run it live

The [demo guide](/guide-demo) runs the whole [Round](/core-concepts#round) lifecycle in your browser. This guide swaps that simulation for the **real backend** ([apps/server](/backend)): a live HTTP service that runs the identical mechanism, settles each Round behind a real **x402** payment gate, and — once you add API keys — produces judgments from **real LLMs**. Same dashboard, real machinery.

![The Veritas dashboard in Live server mode: the In-browser ⇄ Live server toggle is set to Live server, and the header shows the "server · simulated" and "x402 · access paid" chips with settlement flowing through Circle.](/shots/dashboard-live-server.png)

## Step 1 — Start the server

From the repo root:

```bash
pnpm -C apps/server dev
```

The server boots with **zero configuration** — every setting has a demo-safe default. It listens on `http://localhost:8787`, runs the [`simulated` engine](/backend#the-worker-agent-engine), and gates `/api/round` and `/api/leaderboard` with the [x402 gate in `mock` mode](/backend#the-x402-gate). Confirm it's up:

```bash
curl http://localhost:8787/health
# { "ok": true, "engine": "simulated", "x402Mode": "mock" }
```

## Step 2 — Flip the dashboard to Live server

Open the dashboard ([http://localhost:4173](http://localhost:4173)) and find the **In-browser ⇄ Live server** toggle in the header. Switch it to **Live server**. The dashboard now sends each Round to `POST /api/round` instead of computing it client-side.

## Step 3 — Run a Round and read the chips

Run a Round exactly as before. The result is rendered identically, because the server returns the [same `RoundResult` shape](/api#core-types) the browser produces. Watch the header chips — they tell you what just happened:

- **server · simulated** (or **server · live**) — which [engine](/backend#the-worker-agent-engine) produced the Round, straight from `RoundResult.engineUsed`. Right now it reads **simulated**: no LLM keys yet.
- **x402 · access paid** — the [x402 handshake](/backend#the-x402-gate) completed. Under the hood the request first hit an HTTP `402` with a payment-requirements body; the dashboard auto-attached an `X-PAYMENT` header and the gate settled it, returning an `X-Payment-Response`. The "Settled via Circle" indicator marks the per-Report nanopayments.

You're now running the *real* service. The grid, ledger, reputation, and [Leaderboard](/core-concepts#leaderboard) all behave as in the [demo guide](/guide-demo) — only now the numbers came over the wire from a server that ran the real core and cleared a real 402.

## Going fully live

Mock mode and the simulated engine are functional, not faked — but you can make both *real*. Drop a `.env` into `apps/server` (see `apps/server/.env.example` for the full contract). No code changes; just config.

### Real LLM judging

Add at least one provider key and set the engine to `live`:

```bash
VERITAS_ENGINE=live
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
```

Now honest and Reference Workers get their judgments from real LLM calls, **round-robined across whichever keys are present** — three distinct families for [swarm heterogeneity](/architecture#adr-0002). Run a Round and the chip flips to **server · live**. Set any subset of keys; with none set, `live` [gracefully falls back](/backend#the-worker-agent-engine) to `simulated` and the chip honestly says so. (You can also flip a single Round to live with the `engine` field on `POST /api/round`, without restarting.)

### Real x402 settlement

Switch the gate from `mock` to `live` and point it at a funded wallet and a facilitator:

```bash
X402_MODE=live
X402_PAY_TO=0xYourReceivingAddress
X402_FACILITATOR_URL=https://x402.org/facilitator
```

`live` swaps in the real [`x402-express`](https://www.npmjs.com/package/x402-express) middleware, which verifies each payment against the facilitator on `base-sepolia` before letting the Round run. This needs a wallet funded with testnet USDC; the gate initializes lazily, so a misconfiguration fails the *request*, not server startup.

## What you just did

You ran Veritas as a real distributed system: a payable HTTP API, a heterogeneous swarm of real model judges, and a peer-validated Leaderboard — all behind a working x402 gate, with **no oracle** anywhere in the loop. For the full reference, see [Backend & API](/backend) and [ADR-0008](/architecture#adr-0008).
