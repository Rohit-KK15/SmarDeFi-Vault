// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IStrategy {
    function strategyBalance() external view returns (uint256);
    function invest(uint256 amount) external;
    function withdrawToVault(uint256 amount) external returns (uint256);
    function harvest() external;
    function deleverageAll(uint256 maxLoops) external;
}
