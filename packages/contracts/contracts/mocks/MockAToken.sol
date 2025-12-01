// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockAToken is ERC20 {
    address public pool;
    address public underlying;

    // aToken exchange rate (scaled 1e18)
    uint256 public exchangeRate = 1e18;

    constructor(address _underlying, string memory name, string memory symbol)
        ERC20(name, symbol)
    {
        pool = msg.sender;
        underlying = _underlying;
    }

    modifier onlyPool() {
        require(msg.sender == pool, "not pool");
        _;
    }

    function mint(address to, uint256 amt) external onlyPool {
        _mint(to, amt);
    }

    function burn(address from, uint256 amt) external onlyPool {
        _burn(from, amt);
    }

    function setExchangeRate(uint256 newRate) external onlyPool {
        require(newRate >= exchangeRate, "rate only increases");
        exchangeRate = newRate;
    }

    // For strategyBalance()
    function underlyingValue(address user) external view returns (uint256) {
        return (balanceOf(user) * exchangeRate) / 1e18;
    }
}
