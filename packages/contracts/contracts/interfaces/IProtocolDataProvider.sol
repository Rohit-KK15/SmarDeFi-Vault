// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Aave v3 Data Provider Interface
/// @notice Minimal interface required for your Strategy contracts
interface IProtocolDataProvider {
    /// @dev Returns (aToken, stableDebtToken, variableDebtToken)
    function getReserveTokensAddresses(address asset)
        external
        view
        returns (
            address aToken,
            address stableDebtToken,
            address variableDebtToken
        );
}
