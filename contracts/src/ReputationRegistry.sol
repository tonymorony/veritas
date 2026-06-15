// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ReputationRegistry
/// @notice ERC-8004-style reputation store for Veritas Workers. Reputation is an EMA of a
///         Worker's raw Correlated-Agreement score (ADR-0006), held as a signed fixed-point
///         integer scaled by 1e6 (so 1e6 == 1.0, -1e6 == -1.0). It can be negative.
/// @dev Only the authorized writer (the TaskEscrow / scorer operator) may mutate reputation.
///      Tier floors mirror packages/core/src/tier.ts, expressed in the same 1e6 raw scale.
contract ReputationRegistry is Ownable {
    /// @notice Fixed-point scale: 1e6 == a raw CA score of 1.0.
    int256 public constant SCALE = 1e6;

    /// @notice Reputation floors per Tier, in 1e6 raw-CA scale (tier.ts: probation 0,
    ///         standard 0.2, premium 0.4).
    int256 public constant PROBATION_FLOOR = 0;
    int256 public constant STANDARD_FLOOR = 200_000; // 0.2 * 1e6
    int256 public constant PREMIUM_FLOOR = 400_000; // 0.4 * 1e6

    /// @notice The reputation Tier a Worker currently qualifies for.
    enum Tier {
        Ineligible, // below probation floor (negative reputation): excluded from all Rounds
        Probation,
        Standard,
        Premium
    }

    /// @notice The single account allowed to write reputation (the TaskEscrow contract).
    address public authorizedWriter;

    /// @notice Whether a Worker has any recorded reputation yet (distinguishes 0 from unproven).
    mapping(address => bool) public isProven;

    /// @dev Raw signed reputation per Worker, in 1e6 scale.
    mapping(address => int256) private _reputation;

    event AuthorizedWriterSet(address indexed previousWriter, address indexed newWriter);
    event ReputationUpdated(address indexed worker, int256 oldReputation, int256 newReputation);

    error NotAuthorizedWriter(address caller);
    error ZeroAddress();

    modifier onlyWriter() {
        if (msg.sender != authorizedWriter) revert NotAuthorizedWriter(msg.sender);
        _;
    }

    constructor(address owner_) Ownable(owner_) {}

    /// @notice Set the sole account permitted to write reputation (typically the TaskEscrow).
    /// @param writer The new authorized writer.
    function setAuthorizedWriter(address writer) external onlyOwner {
        if (writer == address(0)) revert ZeroAddress();
        emit AuthorizedWriterSet(authorizedWriter, writer);
        authorizedWriter = writer;
    }

    /// @notice Overwrite a Worker's reputation to an absolute value (1e6 raw scale).
    /// @dev The off-chain Scorer computes the EMA (reputation.ts) and submits the result, so
    ///      the chain stays a verifiable mirror of the open algorithm (ADR-0001).
    /// @param worker The Worker whose reputation is being written.
    /// @param newReputation The new signed reputation, scaled by 1e6 (may be negative).
    function setReputation(address worker, int256 newReputation) external onlyWriter {
        int256 old = _reputation[worker];
        _reputation[worker] = newReputation;
        isProven[worker] = true;
        emit ReputationUpdated(worker, old, newReputation);
    }

    /// @notice Read a Worker's raw reputation in 1e6 scale (0 if unproven).
    function reputationOf(address worker) external view returns (int256) {
        return _reputation[worker];
    }

    /// @notice Derive a Worker's eligibility Tier from its reputation and the tier.ts floors.
    /// @dev Unproven Workers (reputation 0) land in Probation, the cold-start path. A Worker
    ///      with negative reputation is Ineligible, excluded even from Probation (tier.ts).
    function tierOf(address worker) external view returns (Tier) {
        int256 rep = _reputation[worker];
        if (rep < PROBATION_FLOOR) return Tier.Ineligible;
        if (rep >= PREMIUM_FLOOR) return Tier.Premium;
        if (rep >= STANDARD_FLOOR) return Tier.Standard;
        return Tier.Probation;
    }
}
