// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice A 6-decimals ERC-20 USDC stand-in with an open `mint` for local/testnet funding.
/// @dev NOT for production. Real deployments wire the canonical USDC address into TaskEscrow.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") {}

    /// @notice USDC uses 6 decimals; mirror that so amounts match the real token.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint tokens to any account. Open by design for funding test agents.
    /// @param to Recipient address.
    /// @param amount Amount in base units (6 decimals).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
