// Committed integration surface for the Veritas on-chain settlement layer.
//
// These artifacts are extracted from `forge build` output and committed (unlike the
// gitignored `out/`) so the TS server can deploy the contracts to anvil on boot via viem
// without a Foundry toolchain. Regenerate after contract changes with:
//
//   cd contracts && forge build && \
//   for n in MockUSDC ReputationRegistry TaskEscrow; do \
//     jq '{abi: .abi, bytecode: .bytecode.object}' out/$n.sol/$n.json > exports/$n.json; \
//   done
//
// Each JSON is { abi: [...], bytecode: "0x..." }. `as const` preserves literal ABI types
// so viem infers function/event signatures.

import mockUSDC from "./MockUSDC.json" with { type: "json" };
import reputationRegistry from "./ReputationRegistry.json" with { type: "json" };
import taskEscrow from "./TaskEscrow.json" with { type: "json" };

export interface ContractArtifact {
  abi: readonly unknown[];
  bytecode: `0x${string}`;
}

export const MockUSDC = mockUSDC as ContractArtifact;
export const ReputationRegistry = reputationRegistry as ContractArtifact;
export const TaskEscrow = taskEscrow as ContractArtifact;

/** All three artifacts keyed by contract name, for iterating at deploy time. */
export const artifacts = {
  MockUSDC,
  ReputationRegistry,
  TaskEscrow,
} as const;

export type ContractName = keyof typeof artifacts;
