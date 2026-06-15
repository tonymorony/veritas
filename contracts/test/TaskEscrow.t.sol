// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {TaskEscrow} from "../src/TaskEscrow.sol";

/// @title TaskEscrowTest
/// @notice Proves the on-chain Round lifecycle matches packages/core/src/settlement.ts:
///         happy-path payouts, partial slash + equal-share redistribution, no-honest -> treasury,
///         commit-no-reveal full slash, the sub-Quorum void path, USDC conservation, and a
///         reputation write (including a negative value).
contract TaskEscrowTest is Test {
    MockUSDC usdc;
    ReputationRegistry reg;
    TaskEscrow escrow;

    address owner = makeAddr("owner");
    address operator = makeAddr("operator");
    address treasury = makeAddr("treasury");
    address requester = makeAddr("requester");

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");

    // Round terms (USDC has 6 decimals).
    uint256 constant BASE_REWARD = 1e6; // 1 USDC per Report
    uint256 constant STAKE = 1e6; // 1 USDC stake
    uint256 constant NUM_TASKS = 2;
    uint256 constant MAX_WORKERS = 4;
    uint256 constant ESCROW = BASE_REWARD * NUM_TASKS * MAX_WORKERS; // 8 USDC

    uint256 constant ROUND_ID = 1;

    function setUp() public {
        usdc = new MockUSDC();
        reg = new ReputationRegistry(owner);
        escrow = new TaskEscrow(usdc, reg, operator, treasury, owner);

        // Wire the escrow as the registry's authorized writer.
        vm.prank(owner);
        reg.setAuthorizedWriter(address(escrow));

        // Fund and approve everyone generously.
        address[5] memory funded = [requester, alice, bob, carol, dave];
        for (uint256 i; i < funded.length; ++i) {
            usdc.mint(funded[i], 1_000e6);
            vm.prank(funded[i]);
            usdc.approve(address(escrow), type(uint256).max);
        }
    }

    // --------------------------------------------------------------------------------------
    // Helpers
    // --------------------------------------------------------------------------------------

    function _commitHash(bytes32 answer, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encode(answer, salt));
    }

    function _open() internal {
        vm.prank(requester);
        escrow.openRound(ROUND_ID, BASE_REWARD, STAKE, NUM_TASKS, MAX_WORKERS);
    }

    function _join(address w, bytes32 answer, bytes32 salt) internal {
        vm.prank(w);
        escrow.joinAndCommit(ROUND_ID, _commitHash(answer, salt));
    }

    function _reveal(address w, bytes32 answer, bytes32 salt) internal {
        vm.prank(w);
        escrow.reveal(ROUND_ID, answer, salt);
    }

    /// @dev Total USDC held across all parties + the escrow contract. Must be invariant.
    function _systemBalance() internal view returns (uint256) {
        return usdc.balanceOf(address(escrow)) + usdc.balanceOf(requester) + usdc.balanceOf(alice)
            + usdc.balanceOf(bob) + usdc.balanceOf(carol) + usdc.balanceOf(dave)
            + usdc.balanceOf(treasury);
    }

    // --------------------------------------------------------------------------------------
    // Happy path: honest payouts + one slashed Worker, stake redistributes equally
    // --------------------------------------------------------------------------------------

    function test_happyPath_payoutsAndEqualRedistribution() public {
        uint256 startSystem = _systemBalance();

        _open();
        assertEq(usdc.balanceOf(address(escrow)), ESCROW, "escrow locked");

        bytes32 salt = keccak256("salt");
        _join(alice, "A", salt);
        _join(bob, "A", salt);
        _join(carol, "B", salt);

        _reveal(alice, "A", salt);
        _reveal(bob, "A", salt);
        _reveal(carol, "B", salt);

        // Off-chain scorer result: alice & bob honest (perfect), carol sub-threshold (slashed).
        address[] memory ws = new address[](3);
        ws[0] = alice;
        ws[1] = bob;
        ws[2] = carol;
        uint256[] memory norm = new uint256[](3);
        norm[0] = 10_000; // 1.0
        norm[1] = 10_000; // 1.0
        norm[2] = 0; // sub-threshold pays nothing
        bool[] memory slashed = new bool[](3);
        slashed[2] = true;
        int256[] memory reps = new int256[](3);
        reps[0] = 1_000_000; // +1.0
        reps[1] = 1_000_000;
        reps[2] = -1_000_000; // negative reputation

        vm.prank(operator);
        escrow.settle(ROUND_ID, ws, norm, slashed, reps);

        // Rewards: alice/bob each baseReward * numTasks * 1.0 = 2 USDC.
        // Carol slashed 50% of 1 USDC stake = 0.5 USDC; honest set = {alice, bob}; each gets
        // 0.25 USDC redistribution. Honest stake fully returned (1 USDC each).
        uint256 aliceGain = 2e6 + 1e6 + 0.25e6; // reward + stake + redistribution
        uint256 bobGain = 2e6 + 1e6 + 0.25e6;
        assertEq(usdc.balanceOf(alice), 1_000e6 - STAKE + aliceGain, "alice payout");
        assertEq(usdc.balanceOf(bob), 1_000e6 - STAKE + bobGain, "bob payout");
        // Carol: paid 0 reward, gets back stake - 0.5 slash = 0.5 USDC.
        assertEq(usdc.balanceOf(carol), 1_000e6 - STAKE + 0.5e6, "carol slashed");

        // Requester refund = escrow(8) - payouts(4) = 4 USDC.
        assertEq(usdc.balanceOf(requester), 1_000e6 - ESCROW + 4e6, "requester refund");

        // No orphaned stake -> treasury untouched.
        assertEq(usdc.balanceOf(treasury), 0, "treasury empty");

        // Reputation written, including the negative value.
        assertEq(reg.reputationOf(carol), -1_000_000, "carol negative reputation");
        assertEq(uint256(reg.tierOf(carol)), uint256(ReputationRegistry.Tier.Ineligible));
        assertEq(uint256(reg.tierOf(alice)), uint256(ReputationRegistry.Tier.Premium));

        // Money conservation: nothing created or destroyed.
        assertEq(_systemBalance(), startSystem, "USDC conserved");
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow drained");
    }

    // --------------------------------------------------------------------------------------
    // No honest recipient: slashed stake orphans to the treasury (ADR-0007)
    // --------------------------------------------------------------------------------------

    function test_noHonest_slashGoesToTreasury() public {
        uint256 startSystem = _systemBalance();
        _open();

        bytes32 salt = keccak256("s");
        _join(alice, "A", salt);
        _join(bob, "B", salt);
        _join(carol, "C", salt);
        _reveal(alice, "A", salt);
        _reveal(bob, "B", salt);
        _reveal(carol, "C", salt);

        // All three sub-threshold: no honest Worker to receive redistribution.
        address[] memory ws = new address[](3);
        ws[0] = alice;
        ws[1] = bob;
        ws[2] = carol;
        uint256[] memory norm = new uint256[](3); // all 0
        bool[] memory slashed = new bool[](3);
        slashed[0] = true;
        slashed[1] = true;
        slashed[2] = true;
        int256[] memory reps = new int256[](3); // all 0

        vm.prank(operator);
        escrow.settle(ROUND_ID, ws, norm, slashed, reps);

        // Each forfeits 0.5 USDC -> 1.5 USDC total orphaned to treasury.
        assertEq(usdc.balanceOf(treasury), 1.5e6, "orphaned stake to treasury");
        // Each gets back 0.5 USDC stake, no reward.
        assertEq(usdc.balanceOf(alice), 1_000e6 - STAKE + 0.5e6, "alice half stake");
        // Requester refunded full escrow (no payouts).
        assertEq(usdc.balanceOf(requester), 1_000e6, "requester full refund");

        assertEq(_systemBalance(), startSystem, "USDC conserved");
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow drained");
    }

    // --------------------------------------------------------------------------------------
    // Commit-but-not-reveal: full slash
    // --------------------------------------------------------------------------------------

    function test_commitNoReveal_fullSlash() public {
        uint256 startSystem = _systemBalance();
        _open();

        bytes32 salt = keccak256("s");
        _join(alice, "A", salt);
        _join(bob, "A", salt);
        _join(carol, "B", salt);
        _join(dave, "A", salt); // commits but never reveals

        _reveal(alice, "A", salt);
        _reveal(bob, "A", salt);
        _reveal(carol, "B", salt);
        // dave does NOT reveal -> full slash regardless of supplied score.

        address[] memory ws = new address[](4);
        ws[0] = alice;
        ws[1] = bob;
        ws[2] = carol;
        ws[3] = dave;
        uint256[] memory norm = new uint256[](4);
        norm[0] = 10_000;
        norm[1] = 10_000;
        norm[2] = 10_000;
        norm[3] = 10_000; // ignored: dave never revealed
        bool[] memory slashed = new bool[](4); // all false; dave still full-slashed on-chain
        int256[] memory reps = new int256[](4);
        reps[0] = 1_000_000;
        reps[1] = 1_000_000;
        reps[2] = 1_000_000;
        reps[3] = -500_000;

        vm.prank(operator);
        escrow.settle(ROUND_ID, ws, norm, slashed, reps);

        // Dave forfeits 100% of his 1 USDC stake; honest set {alice,bob,carol} -> 1/3 USDC each.
        uint256 totalSlashedDave = 1e6;
        uint256 share = totalSlashedDave / 3; // integer division; dust to treasury
        assertEq(usdc.balanceOf(dave), 1_000e6 - STAKE, "dave fully slashed");
        // alice reward 2 + stake 1 + share.
        assertEq(usdc.balanceOf(alice), 1_000e6 - STAKE + 2e6 + 1e6 + share, "alice w/ redistribution");
        // Treasury gets the rounding dust (1e6 - 3*share).
        assertEq(usdc.balanceOf(treasury), totalSlashedDave - 3 * share, "rounding dust to treasury");

        assertEq(_systemBalance(), startSystem, "USDC conserved");
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow drained");
    }

    // --------------------------------------------------------------------------------------
    // Sub-Quorum void: full refund, all stake back, no slash, no reputation change
    // --------------------------------------------------------------------------------------

    function test_void_subQuorumRefund() public {
        uint256 startSystem = _systemBalance();
        _open();

        bytes32 salt = keccak256("s");
        _join(alice, "A", salt);
        _join(bob, "A", salt);
        // Only two reveal -> below Quorum (needs >=3 revealing Workers).
        _reveal(alice, "A", salt);
        _reveal(bob, "A", salt);

        address[] memory ws = new address[](2);
        ws[0] = alice;
        ws[1] = bob;
        uint256[] memory norm = new uint256[](2);
        bool[] memory slashed = new bool[](2);
        int256[] memory reps = new int256[](2);
        reps[0] = 9_999; // would-be write; must NOT be applied on void

        vm.prank(operator);
        escrow.settle(ROUND_ID, ws, norm, slashed, reps);

        // Round voided: everyone whole again.
        assertEq(usdc.balanceOf(alice), 1_000e6, "alice stake returned");
        assertEq(usdc.balanceOf(bob), 1_000e6, "bob stake returned");
        assertEq(usdc.balanceOf(requester), 1_000e6, "escrow refunded");
        assertEq(usdc.balanceOf(treasury), 0, "no treasury on void");

        // No reputation change on void.
        assertFalse(reg.isProven(alice), "no reputation write on void");
        assertEq(reg.reputationOf(alice), 0, "alice reputation unchanged");

        ( , , , , , , , , TaskEscrow.RoundState state, ) = escrow.getRound(ROUND_ID);
        assertEq(uint256(state), uint256(TaskEscrow.RoundState.Voided), "state voided");

        assertEq(_systemBalance(), startSystem, "USDC conserved");
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow drained");
    }

    // --------------------------------------------------------------------------------------
    // Guards
    // --------------------------------------------------------------------------------------

    function test_reveal_revertsOnBadSalt() public {
        _open();
        bytes32 salt = keccak256("s");
        _join(alice, "A", salt);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(TaskEscrow.BadReveal.selector, ROUND_ID, alice)
        );
        escrow.reveal(ROUND_ID, "A", keccak256("wrong"));
    }

    function test_settle_onlyOperator() public {
        _open();
        bytes32 salt = keccak256("s");
        _join(alice, "A", salt);
        _join(bob, "A", salt);
        _join(carol, "B", salt);
        _reveal(alice, "A", salt);
        _reveal(bob, "A", salt);
        _reveal(carol, "B", salt);

        address[] memory ws = new address[](3);
        ws[0] = alice;
        ws[1] = bob;
        ws[2] = carol;
        uint256[] memory norm = new uint256[](3);
        bool[] memory slashed = new bool[](3);
        int256[] memory reps = new int256[](3);

        vm.expectRevert(abi.encodeWithSelector(TaskEscrow.NotOperator.selector, address(this)));
        escrow.settle(ROUND_ID, ws, norm, slashed, reps);
    }

    function test_joinTwice_reverts() public {
        _open();
        bytes32 salt = keccak256("s");
        _join(alice, "A", salt);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(TaskEscrow.AlreadyCommitted.selector, ROUND_ID, alice)
        );
        escrow.joinAndCommit(ROUND_ID, _commitHash("A", salt));
    }

    function test_registry_onlyWriter() public {
        vm.expectRevert(
            abi.encodeWithSelector(ReputationRegistry.NotAuthorizedWriter.selector, address(this))
        );
        reg.setReputation(alice, 123);
    }

    function testFuzz_settle_conserves(uint8 rawNormA, uint8 rawNormB, bool slashC) public {
        _open();
        bytes32 salt = keccak256("s");
        _join(alice, "A", salt);
        _join(bob, "A", salt);
        _join(carol, "B", salt);
        _reveal(alice, "A", salt);
        _reveal(bob, "A", salt);
        _reveal(carol, "B", salt);

        uint256 startSystem = _systemBalance();

        address[] memory ws = new address[](3);
        ws[0] = alice;
        ws[1] = bob;
        ws[2] = carol;
        uint256[] memory norm = new uint256[](3);
        norm[0] = (uint256(rawNormA) * 10_000) / 255;
        norm[1] = (uint256(rawNormB) * 10_000) / 255;
        norm[2] = slashC ? 0 : 10_000;
        bool[] memory slashed = new bool[](3);
        slashed[2] = slashC;
        int256[] memory reps = new int256[](3);

        vm.prank(operator);
        escrow.settle(ROUND_ID, ws, norm, slashed, reps);

        // Regardless of scores, USDC is conserved and the escrow is fully drained.
        assertEq(_systemBalance(), startSystem, "USDC conserved under fuzz");
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow drained under fuzz");
    }
}
