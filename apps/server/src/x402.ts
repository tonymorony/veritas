/**
 * The x402 payment gate (ADR-0003: x402 at the API boundary). Three modes:
 *  - `off`   — open, no gate (default, so the demo runs with zero setup).
 *  - `mock`  — a real HTTP 402 challenge with a payment-requirements body when no
 *              `X-PAYMENT` header is present; any `X-PAYMENT` header is accepted as paid.
 *              Demonstrates the real handshake without a funded wallet.
 *  - `live`  — real `x402-express` middleware against a facilitator (needs a funded wallet).
 */
import type { RequestHandler } from "express";
import type { ServerConfig } from "./config";

const PRICE_USDC = "$0.01";
const NETWORK = "base-sepolia";

/** Build the gate middleware for the configured mode and the protected resource path. */
export function makeX402Gate(config: ServerConfig, resourcePath: string): RequestHandler {
  if (config.x402Mode === "off") {
    return (_req, _res, next) => next();
  }
  if (config.x402Mode === "mock") {
    return mockGate(config, resourcePath);
  }
  return liveGate(config, resourcePath);
}

/**
 * Mock gate: emit a spec-shaped 402 with payment requirements when `X-PAYMENT` is missing;
 * accept any `X-PAYMENT` value as settled and attach an `X-Payment-Response` header.
 */
function mockGate(config: ServerConfig, resourcePath: string): RequestHandler {
  return (req, res, next) => {
    const payment = req.header("X-PAYMENT");
    if (!payment) {
      res.status(402).json({
        x402Version: 1,
        error: "X-PAYMENT header is required",
        accepts: [
          {
            scheme: "exact",
            network: NETWORK,
            maxAmountRequired: "10000", // 0.01 USDC (6 decimals)
            resource: resourcePath,
            description: "Veritas: settle a peer-prediction Round",
            mimeType: "application/json",
            payTo: config.payTo,
            maxTimeoutSeconds: 60,
            asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            extra: { name: "USDC", version: "2" },
          },
        ],
      });
      return;
    }
    // Any payment header is accepted in mock mode — demonstrate the settled handshake.
    res.setHeader(
      "X-Payment-Response",
      Buffer.from(
        JSON.stringify({ success: true, network: NETWORK, payer: "mock", txHash: "0xmock" }),
      ).toString("base64"),
    );
    next();
  };
}

/** Live gate: real x402-express middleware. Requires a funded wallet + facilitator. */
function liveGate(config: ServerConfig, resourcePath: string): RequestHandler {
  let delegate: RequestHandler | undefined;
  let initError: Error | undefined;

  // Construct the real middleware lazily so the server still boots if x402-express or its
  // peer deps are misconfigured; a misconfigured live gate fails the request, not startup.
  const init = async (): Promise<RequestHandler> => {
    const { paymentMiddleware } = await import("x402-express");
    return paymentMiddleware(
      config.payTo as `0x${string}`,
      {
        [resourcePath]: {
          price: PRICE_USDC,
          network: NETWORK,
          config: { description: "Veritas: settle a peer-prediction Round" },
        },
      },
      { url: config.facilitatorUrl as `${string}://${string}` },
    );
  };
  const ready = init().then(
    (m) => (delegate = m),
    (e) => (initError = e as Error),
  );

  return async (req, res, next) => {
    await ready;
    if (initError || !delegate) {
      res.status(500).json({
        error: "x402 live mode unavailable",
        detail: initError?.message ?? "middleware not initialized",
      });
      return;
    }
    return delegate(req, res, next);
  };
}
