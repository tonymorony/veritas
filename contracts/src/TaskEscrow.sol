// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ReputationRegistry} from "./ReputationRegistry.sol";

/// @title TaskEscrow
/// @notice ERC-8183-style escrow that runs the on-chain Veritas Round lifecycle in USDC:
///         open -> commit -> reveal -> settle (or void below Quorum). The off-chain Scorer
///         computes Correlated-Agreement results; this contract enforces the settlement math
///         (ADR-0001: inputs on-chain, results submitted, anyone can recompute) and conserves
///         every unit of USDC.
/// @dev Mirrors packages/core/src/settlement.ts exactly:
///        - per-Report payout = baseReward * normalizedScore, drawn from Escrow
///        - sub-threshold (slashed) Workers forfeit 50% of Stake; not-revealed Workers forfeit 100%
///        - slashed Stake is redistributed in EQUAL shares to honest (above-threshold) Workers
///        - with no honest Worker, orphaned Stake -> treasury, never the Requester (ADR-0007)
///        - Requester is refunded escrow - totalPayouts
///        - below Quorum -> void: full escrow refund, all Stake returned, no slash, no reputation
contract TaskEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Basis points denominator for normalized scores (10000 == 1.0).
    uint256 public constant BPS = 10_000;

    /// @notice Quorum floor (CONTEXT.md / quorum.ts): >=3 revealing Workers.
    uint256 public constant QUORUM_MIN_WORKERS = 3;

    /// @notice Stake forfeited by a sub-threshold (revealed-but-dishonest) Worker, in bps (50%).
    uint256 public constant PARTIAL_SLASH_BPS = 5_000;

    enum RoundState {
        None,
        Open, // accepting commits / reveals
        Settled,
        Voided
    }

    /// @dev A Worker's per-Round participation record.
    struct Participant {
        bool committed;
        bool revealed;
        bytes32 commitHash;
        bytes32 answer; // revealed answer (for on-chain auditability of the grid)
    }

    /// @dev A Round's immutable terms plus mutable lifecycle bookkeeping.
    struct Round {
        address requester;
        uint256 baseReward; // per-Report reward (USDC base units)
        uint256 stakeAmount; // per-Worker Stake (USDC base units)
        uint256 numTasks; // Tasks per Worker (every revealing Worker answers the full grid)
        uint256 maxWorkers; // Assignment size M; sizes the Escrow
        uint256 escrow; // baseReward * numTasks * maxWorkers, locked at open
        uint256 stakePool; // sum of Stake currently held for this Round
        uint256 revealedCount;
        RoundState state;
        address[] workers; // join order; the on-chain participant set
    }

    IERC20 public immutable usdc;
    ReputationRegistry public immutable reputation;

    /// @notice Protocol treasury that receives orphaned slashed Stake (ADR-0007).
    address public treasury;

    /// @notice The authorized Scorer/operator allowed to call settle/void.
    address public operator;

    mapping(uint256 => Round) private _rounds;
    mapping(uint256 => mapping(address => Participant)) private _participants;

    event RoundOpened(
        uint256 indexed roundId,
        address indexed requester,
        uint256 baseReward,
        uint256 stakeAmount,
        uint256 numTasks,
        uint256 maxWorkers,
        uint256 escrow
    );
    event Committed(uint256 indexed roundId, address indexed worker, bytes32 commitHash);
    event Revealed(uint256 indexed roundId, address indexed worker, bytes32 answer);
    event Slashed(uint256 indexed roundId, address indexed worker, uint256 amount, bool fullSlash);
    event PayoutSettled(
        uint256 indexed roundId,
        address indexed worker,
        uint256 reward,
        uint256 stakeReturned,
        uint256 redistribution
    );
    event Settled(
        uint256 indexed roundId,
        uint256 totalPayouts,
        uint256 totalRedistributed,
        uint256 treasuryAmount,
        uint256 requesterRefund
    );
    event Voided(uint256 indexed roundId, uint256 escrowRefunded, uint256 stakeReturned);
    event OperatorSet(address indexed previousOperator, address indexed newOperator);
    event TreasurySet(address indexed previousTreasury, address indexed newTreasury);

    error NotOperator(address caller);
    error ZeroAddress();
    error RoundExists(uint256 roundId);
    error RoundNotOpen(uint256 roundId);
    error InvalidTerms();
    error AlreadyCommitted(uint256 roundId, address worker);
    error NotCommitted(uint256 roundId, address worker);
    error AlreadyRevealed(uint256 roundId, address worker);
    error BadReveal(uint256 roundId, address worker);
    error LengthMismatch();
    error NotParticipant(uint256 roundId, address worker);
    error Conservation(uint256 lhs, uint256 rhs);

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator(msg.sender);
        _;
    }

    /// @param usdc_ The USDC token (MockUSDC locally; canonical USDC on testnet/mainnet).
    /// @param reputation_ The ReputationRegistry this escrow is the authorized writer for.
    /// @param operator_ The off-chain Scorer/operator allowed to settle/void.
    /// @param treasury_ The protocol treasury for orphaned slashed Stake.
    /// @param owner_ Contract owner (can rotate operator/treasury).
    constructor(
        IERC20 usdc_,
        ReputationRegistry reputation_,
        address operator_,
        address treasury_,
        address owner_
    ) Ownable(owner_) {
        if (
            address(usdc_) == address(0) || address(reputation_) == address(0)
                || operator_ == address(0) || treasury_ == address(0)
        ) {
            revert ZeroAddress();
        }
        usdc = usdc_;
        reputation = reputation_;
        operator = operator_;
        treasury = treasury_;
    }

    // --------------------------------------------------------------------------------------
    // Admin
    // --------------------------------------------------------------------------------------

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert ZeroAddress();
        emit OperatorSet(operator, newOperator);
        operator = newOperator;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasurySet(treasury, newTreasury);
        treasury = newTreasury;
    }

    // --------------------------------------------------------------------------------------
    // Lifecycle
    // --------------------------------------------------------------------------------------

    /// @notice Open a Round and lock the Requester's Escrow.
    /// @dev Escrow = baseReward * numTasks * maxWorkers — the maximum payout, when every one of
    ///      the M assigned Workers scores a perfect 1.0 on every Task. Unspent Escrow refunds at
    ///      settle (CONTEXT.md: Escrow). The Requester must approve this contract for the Escrow.
    /// @param roundId Caller-chosen unique Round id.
    /// @param baseReward Per-Report reward in USDC base units.
    /// @param stakeAmount Per-Worker Stake in USDC base units.
    /// @param numTasks Number of Tasks per Worker (the grid width).
    /// @param maxWorkers Assignment size M; sizes the Escrow.
    function openRound(
        uint256 roundId,
        uint256 baseReward,
        uint256 stakeAmount,
        uint256 numTasks,
        uint256 maxWorkers
    ) external nonReentrant {
        if (_rounds[roundId].state != RoundState.None) revert RoundExists(roundId);
        if (baseReward == 0 || numTasks == 0 || maxWorkers == 0) revert InvalidTerms();

        uint256 escrow = baseReward * numTasks * maxWorkers;

        Round storage r = _rounds[roundId];
        r.requester = msg.sender;
        r.baseReward = baseReward;
        r.stakeAmount = stakeAmount;
        r.numTasks = numTasks;
        r.maxWorkers = maxWorkers;
        r.escrow = escrow;
        r.state = RoundState.Open;

        emit RoundOpened(roundId, msg.sender, baseReward, stakeAmount, numTasks, maxWorkers, escrow);

        // Interaction last; SafeERC20 handles non-standard return values.
        usdc.safeTransferFrom(msg.sender, address(this), escrow);
    }

    /// @notice Join a Round as a Worker by posting Stake and a commit hash.
    /// @dev commit = keccak256(abi.encode(answer, salt)). Assignment and the reputable-majority
    ///      floor (ADR-0005) are enforced off-chain by the operator; this is open-join for the
    ///      hackathon and the operator only scores the assigned set. A Worker joins once.
    /// @param roundId The Round to join.
    /// @param commitHash The Worker's binding commitment.
    function joinAndCommit(uint256 roundId, bytes32 commitHash) external nonReentrant {
        Round storage r = _rounds[roundId];
        if (r.state != RoundState.Open) revert RoundNotOpen(roundId);

        Participant storage p = _participants[roundId][msg.sender];
        if (p.committed) revert AlreadyCommitted(roundId, msg.sender);

        p.committed = true;
        p.commitHash = commitHash;
        r.workers.push(msg.sender);
        r.stakePool += r.stakeAmount;

        emit Committed(roundId, msg.sender, commitHash);

        if (r.stakeAmount > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), r.stakeAmount);
        }
    }

    /// @notice Reveal a previously committed Report. Verifies against the commit hash.
    /// @dev Committed-but-not-revealed Workers are fully slashed at settle (CONTEXT.md).
    /// @param roundId The Round.
    /// @param answer The cleartext categorical answer (encoded as bytes32).
    /// @param salt The blinding salt used in the commit.
    function reveal(uint256 roundId, bytes32 answer, bytes32 salt) external {
        Round storage r = _rounds[roundId];
        if (r.state != RoundState.Open) revert RoundNotOpen(roundId);

        Participant storage p = _participants[roundId][msg.sender];
        if (!p.committed) revert NotCommitted(roundId, msg.sender);
        if (p.revealed) revert AlreadyRevealed(roundId, msg.sender);
        if (keccak256(abi.encode(answer, salt)) != p.commitHash) revert BadReveal(roundId, msg.sender);

        p.revealed = true;
        p.answer = answer;
        r.revealedCount += 1;

        emit Revealed(roundId, msg.sender, answer);
    }

    /// @notice Settle a Round after off-chain Correlated-Agreement scoring.
    /// @dev Operator-only (the verifiable-not-trusted Scorer, ADR-0001). Enforces settlement.ts:
    ///        reward[i]       = baseReward * numTasks * normalizedBps[i] / BPS   (from Escrow)
    ///        slash[i]        = 100% of Stake if Worker did not reveal,
    ///                          else 50% of Stake if slashed[i], else 0
    ///        redistribution  = totalSlashed split EQUALLY among honest (non-slashed) Workers
    ///        treasury        = totalSlashed if there is no honest Worker (ADR-0007)
    ///        requesterRefund = escrow - totalPayouts
    ///      Reverts unless USDC conserves: escrow + stakePool == payouts + stakeReturned +
    ///      redistribution + requesterRefund + treasury.
    /// @param roundId The Round to settle.
    /// @param workers The scored Worker set (must be the Round's participants).
    /// @param normalizedBps Per-Worker normalized score in basis points (0..10000).
    /// @param slashed Per-Worker sub-threshold flag (raw CA <= 0) from the off-chain scorer.
    /// @param reputationDeltas Per-Worker new absolute reputation (1e6 raw scale) to record.
    function settle(
        uint256 roundId,
        address[] calldata workers,
        uint256[] calldata normalizedBps,
        bool[] calldata slashed,
        int256[] calldata reputationDeltas
    ) external onlyOperator nonReentrant {
        Round storage r = _rounds[roundId];
        if (r.state != RoundState.Open) revert RoundNotOpen(roundId);
        uint256 n = workers.length;
        if (
            n != normalizedBps.length || n != slashed.length || n != reputationDeltas.length
                || n != r.workers.length
        ) {
            revert LengthMismatch();
        }

        // Below Quorum -> void: full refund, all Stake back, no slash, no reputation change.
        if (r.revealedCount < QUORUM_MIN_WORKERS) {
            _void(roundId, r);
            return;
        }

        r.state = RoundState.Settled;

        // Pass 1: compute rewards, per-Worker slash, and the honest set, in memory.
        uint256[] memory reward = new uint256[](n);
        uint256[] memory slashAmt = new uint256[](n);
        uint256 totalPayouts;
        uint256 totalSlashed;
        uint256 honestCount;

        for (uint256 i; i < n; ++i) {
            address w = workers[i];
            Participant storage p = _participants[roundId][w];
            if (!p.committed) revert NotParticipant(roundId, w);
            if (normalizedBps[i] > BPS) revert InvalidTerms();

            // Not-revealed Workers forfeit 100% and earn nothing, regardless of the score input.
            if (!p.revealed) {
                slashAmt[i] = r.stakeAmount;
            } else if (slashed[i]) {
                slashAmt[i] = (r.stakeAmount * PARTIAL_SLASH_BPS) / BPS;
                reward[i] = (r.baseReward * r.numTasks * normalizedBps[i]) / BPS;
            } else {
                reward[i] = (r.baseReward * r.numTasks * normalizedBps[i]) / BPS;
                honestCount += 1;
            }

            totalPayouts += reward[i];
            totalSlashed += slashAmt[i];
        }

        // Equal-share redistribution to honest Workers; remainder of integer division stays in
        // the pot and is swept to treasury to keep USDC exactly conserved.
        uint256 share = honestCount > 0 ? totalSlashed / honestCount : 0;
        uint256 distributed = share * honestCount;
        uint256 treasuryAmount = totalSlashed - distributed; // orphaned (no honest) or rounding dust

        // Pass 2: push USDC and record reputation. CEI: state already moved to Settled.
        uint256 totalStakeReturned;
        for (uint256 i; i < n; ++i) {
            address w = workers[i];
            Participant storage p = _participants[roundId][w];

            uint256 stakeReturned = r.stakeAmount - slashAmt[i];
            bool honest = p.revealed && !slashed[i];
            uint256 redistribution = honest ? share : 0;
            uint256 owed = reward[i] + stakeReturned + redistribution;

            totalStakeReturned += stakeReturned;

            reputation.setReputation(w, reputationDeltas[i]);

            if (slashAmt[i] > 0) {
                emit Slashed(roundId, w, slashAmt[i], !p.revealed);
            }
            emit PayoutSettled(roundId, w, reward[i], stakeReturned, redistribution);

            if (owed > 0) usdc.safeTransfer(w, owed);
        }

        uint256 requesterRefund = r.escrow - totalPayouts;

        // Money conservation (settlement.ts invariant): every locked unit is accounted for.
        uint256 lhs = r.escrow + r.stakePool;
        uint256 rhs =
            totalPayouts + totalStakeReturned + distributed + requesterRefund + treasuryAmount;
        if (lhs != rhs) revert Conservation(lhs, rhs);

        if (treasuryAmount > 0) usdc.safeTransfer(treasury, treasuryAmount);
        if (requesterRefund > 0) usdc.safeTransfer(r.requester, requesterRefund);

        emit Settled(roundId, totalPayouts, distributed, treasuryAmount, requesterRefund);
    }

    /// @notice Explicitly void a sub-Quorum Round (refund Escrow, return all Stake, no slash).
    /// @dev Also reachable automatically from settle when revealedCount < Quorum. Operator-only.
    function void(uint256 roundId) external onlyOperator nonReentrant {
        Round storage r = _rounds[roundId];
        if (r.state != RoundState.Open) revert RoundNotOpen(roundId);
        _void(roundId, r);
    }

    /// @dev Voided Round (CONTEXT.md): Escrow fully refunded; every committed Worker gets Stake
    ///      back with no honesty slash and no Reputation change. Note: unlike the off-chain
    ///      model (which slashes commit-no-reveal even on void), the on-chain void path returns
    ///      all Stake — a sub-Quorum Round produced no scorable grid, so nothing is forfeited.
    function _void(uint256 roundId, Round storage r) private {
        r.state = RoundState.Voided;

        uint256 totalStakeReturned;
        address[] storage ws = r.workers;
        uint256 len = ws.length;
        for (uint256 i; i < len; ++i) {
            address w = ws[i];
            uint256 stake = r.stakeAmount;
            totalStakeReturned += stake;
            emit PayoutSettled(roundId, w, 0, stake, 0);
            if (stake > 0) usdc.safeTransfer(w, stake);
        }

        // Conservation on the void path: escrow + stakePool == escrowRefund + stakeReturned.
        uint256 lhs = r.escrow + r.stakePool;
        uint256 rhs = r.escrow + totalStakeReturned;
        if (lhs != rhs) revert Conservation(lhs, rhs);

        if (r.escrow > 0) usdc.safeTransfer(r.requester, r.escrow);

        emit Voided(roundId, r.escrow, totalStakeReturned);
    }

    // --------------------------------------------------------------------------------------
    // Views
    // --------------------------------------------------------------------------------------

    function getRound(uint256 roundId)
        external
        view
        returns (
            address requester,
            uint256 baseReward,
            uint256 stakeAmount,
            uint256 numTasks,
            uint256 maxWorkers,
            uint256 escrow,
            uint256 stakePool,
            uint256 revealedCount,
            RoundState state,
            uint256 workerCount
        )
    {
        Round storage r = _rounds[roundId];
        return (
            r.requester,
            r.baseReward,
            r.stakeAmount,
            r.numTasks,
            r.maxWorkers,
            r.escrow,
            r.stakePool,
            r.revealedCount,
            r.state,
            r.workers.length
        );
    }

    function getWorkers(uint256 roundId) external view returns (address[] memory) {
        return _rounds[roundId].workers;
    }

    function getParticipant(uint256 roundId, address worker)
        external
        view
        returns (bool committed, bool revealed, bytes32 commitHash, bytes32 answer)
    {
        Participant storage p = _participants[roundId][worker];
        return (p.committed, p.revealed, p.commitHash, p.answer);
    }
}
