// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Minimal Protocol Data Provider for tests
/// Maps underlying token -> aToken (and returns zeros for debt tokens)
contract MockProtocolDataProvider {
    mapping(address => address) public aTokenFor;

    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    /// set aToken address for an underlying token (callable by deployer/admin)
    function setAToken(address underlying, address aToken) external onlyOwner {
        aTokenFor[underlying] = aToken;
    }

    /// Aave-compatible view used by strategies:
    /// returns (aTokenAddress, stableDebtTokenAddress, variableDebtTokenAddress)
    function getReserveTokensAddresses(address underlying)
        external
        view
        returns (address aToken, address stableDebtToken, address variableDebtToken)
    {
        aToken = aTokenFor[underlying];
        stableDebtToken = address(0);
        variableDebtToken = address(0);
    }
}
