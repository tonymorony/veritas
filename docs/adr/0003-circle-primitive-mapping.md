# Circle primitive mapping: x402 at the API boundary, nanopayments for Settlement

The plan's phrase "x402 nanopayments" conflates two distinct primitives. We separate them by
surface:

- **x402 (HTTP-402 pay-per-request) → the API/MCP boundary.** Agents pay x402 to *post a Round* or
  *pull Leaderboard results*. This matches x402's intended "pay to use a service" shape.
- **Gateway nanopayments → Settlement.** Per-Report escrow→Worker payouts settle as sub-cent
  Gateway nanopayments — the source of the high-volume on-chain micro-settlement count.
- **Paymaster → gasless UX.** Gas-in-USDC so anyone can run the full loop without holding native gas.
- **ERC-8004 → Agent identity + Reputation registry; ERC-8183-style → Round escrow.**

We explicitly reject the facilitator-pays-out reading where x402 itself disburses Worker payouts —
that would overload a request-time protocol with contract-time settlement and weaken the x402 story.

## Status

Provisional. Exact integration interfaces are a D1 research output (read ERC-8004/8183 + x402 +
nanopayment reference impls); this ADR fixes the *conceptual placement*, to be confirmed/adjusted
against the real libraries.
