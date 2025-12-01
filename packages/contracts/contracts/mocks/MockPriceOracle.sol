// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// Very small price oracle: admin can set price (price scaled by 1e18)
contract MockPriceOracle {
    address public owner;
    // price: LINK per WETH (1 WETH -> price LINK) scaled 1e18
    uint256 public price; 

    constructor(uint256 initialPrice) {
        owner = msg.sender;
        price = initialPrice;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "owner");
        _;
    }

    function setPrice(uint256 p) external onlyOwner {
        price = p;
    }

    function getPrice(address /* token */) external view returns (uint256) {
        return price;
    }

    function getPrices() external view returns (uint256 linkPrice, uint256 wethPrice) {
        return (price, 1e18);
    }

}
