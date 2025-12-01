// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockSwapRouterV2 {
    using SafeERC20 for IERC20;

    // naive reserves mapping (token => amount in router)
    mapping(address => uint256) public reserve;

    event LiquiditySeeded(address token, uint256 amount);
    event Swap(address indexed from, address indexed to, uint256 amountIn, uint256 amountOut);

    function seedLiquidity(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        reserve[token] += amount;
        emit LiquiditySeeded(token, amount);
    }

    // constant product simple swap (two-token path only)
    function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint) external returns (uint[] memory amounts) {
        require(path.length == 2, "path len");
        address inT = path[0];
        address outT = path[1];
        // transfer amountIn from caller
        IERC20(inT).safeTransferFrom(msg.sender, address(this), amountIn);
        reserve[inT] += amountIn;

        uint256 x = reserve[inT];
        uint256 y = reserve[outT];
        require(x > 0 && y > 0, "empty pool");

        // simple formula: amountOut = amountIn * y / (x) * 0.997  (approx)
        uint256 amountOut = (amountIn * y) / x;
        // apply tiny fee
        amountOut = (amountOut * 997) / 1000;
        require(amountOut >= amountOutMin, "slippage");

        // send out
        reserve[outT] -= amountOut;
        IERC20(outT).safeTransfer(to, amountOut);
        amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
        emit Swap(inT, outT, amountIn, amountOut);
    }

    // helper views
    function getReserve(address token) external view returns (uint256) { return reserve[token]; }
}
