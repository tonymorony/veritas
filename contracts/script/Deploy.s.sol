// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {TaskEscrow} from "../src/TaskEscrow.sol";

/// @title Deploy
/// @notice Deploys MockUSDC + ReputationRegistry + TaskEscrow, wires the registry's authorized
///         writer to the escrow, and (locally) mints USDC to a set of accounts.
/// @dev Env-driven so it works on anvil AND an EVM testnet (Arc/etc.):
///        PRIVATE_KEY     - deployer key (defaults to anvil account #0 if unset)
///        OPERATOR        - the off-chain Scorer/operator (defaults to deployer)
///        TREASURY        - protocol treasury for orphaned stake (defaults to deployer)
///        MINT_RECIPIENTS - comma-separated addresses to fund with MockUSDC (optional)
///        MINT_AMOUNT     - USDC base units to mint each recipient (default 1_000_000e6)
contract Deploy is Script {
    // anvil default account #0 private key (local only).
    uint256 constant ANVIL_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external {
        uint256 pk = vm.envOr("PRIVATE_KEY", ANVIL_PK);
        address deployer = vm.addr(pk);
        address operator = vm.envOr("OPERATOR", deployer);
        address treasury = vm.envOr("TREASURY", deployer);
        uint256 mintAmount = vm.envOr("MINT_AMOUNT", uint256(1_000_000e6));

        vm.startBroadcast(pk);

        MockUSDC usdc = new MockUSDC();
        ReputationRegistry reg = new ReputationRegistry(deployer);
        TaskEscrow escrow = new TaskEscrow(usdc, reg, operator, treasury, deployer);

        // Wire the escrow as the registry's sole authorized reputation writer.
        reg.setAuthorizedWriter(address(escrow));

        // Local funding: mint USDC to recipients so demo agents can stake/escrow immediately.
        address[] memory recipients = _mintRecipients(deployer);
        for (uint256 i; i < recipients.length; ++i) {
            usdc.mint(recipients[i], mintAmount);
        }

        vm.stopBroadcast();

        console2.log("MockUSDC:          ", address(usdc));
        console2.log("ReputationRegistry:", address(reg));
        console2.log("TaskEscrow:        ", address(escrow));
        console2.log("deployer/owner:    ", deployer);
        console2.log("operator:          ", operator);
        console2.log("treasury:          ", treasury);
    }

    /// @dev MINT_RECIPIENTS if provided, else the deployer plus anvil accounts #1..#3.
    function _mintRecipients(address deployer) internal view returns (address[] memory) {
        address[] memory parsed = vm.envOr("MINT_RECIPIENTS", ",", new address[](0));
        if (parsed.length > 0) return parsed;

        address[] memory defaults = new address[](4);
        defaults[0] = deployer;
        defaults[1] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // anvil #1
        defaults[2] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; // anvil #2
        defaults[3] = 0x90F79bf6EB2c4f870365E785982E1f101E93b906; // anvil #3
        return defaults;
    }
}
