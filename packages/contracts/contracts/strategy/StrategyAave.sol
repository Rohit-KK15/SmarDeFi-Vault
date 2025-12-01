// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IProtocolDataProvider.sol";

// Minimal Aave v3 interfaces we need
interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function getUnderlyingValue(address user, address token) external view returns (uint256);
}

contract StrategyAaveV3 is IStrategy {
    using SafeERC20 for IERC20;

    IERC20 public immutable token; // underlying (USDC)
    address public immutable vault;
    address public immutable router;
    IPool public immutable pool;
    IProtocolDataProvider public immutable dataProvider;

    // track principal or rely on aToken for actual on-chain balance
    uint256 public deposited; // useful for some bookkeeping, but we use aToken to get actual balance

    constructor(address _asset, address _vault, address _router, address _pool, address _dataProvider) {
        token = IERC20(_asset);
        vault = _vault;
        router = _router;
        pool = IPool(_pool);
        dataProvider = IProtocolDataProvider(_dataProvider);
        token.approve(address(pool), type(uint256).max);
    }

    modifier onlyRouter() {
        require(msg.sender == router, "not router");
        _;
    }

    function estimateAPY() external view returns (uint256) {
        (address aTokenAddr,,) = dataProvider.getReserveTokensAddresses(address(token));
        uint256 aBal = IERC20(aTokenAddr).balanceOf(address(this));

        if (deposited == 0) return 0;
        uint256 profit = aBal > deposited ? aBal - deposited : 0;

        return (profit * 1e18) / deposited; 
    }


    // Router sends funds by calling vault.moveToStrategy() which transfers tokens directly to strategy address.
    // invest(): strategy already holds tokens transferred from vault, but we'll accept amount param and call pool.supply() using token.balanceOf(this) or amount.
    function invest(uint256 amount) external override onlyRouter {
        // assume vault already transferred `amount` tokens to this contract using vault.moveToStrategy
        // supply amount
        pool.supply(address(token), amount, address(this), 0);
        deposited += amount;
    }

    function withdrawToVault(uint256 amount) external override onlyRouter returns(uint256) {
        // withdraw underlying from aave to this contract, then transfer to vault
        uint256 out = pool.withdraw(address(token), amount, address(this));
        token.safeTransfer(vault, out);

        if (out <= deposited) deposited -= out;
        else deposited = 0;

        return out;
    }

    function harvest() external override onlyRouter {
        // To harvest interest, compute current aToken underlying balance and send any profit back to vault
        // get aToken address
        (address aTokenAddr, , ) = dataProvider.getReserveTokensAddresses(address(token));
        uint256 aBal = IERC20(aTokenAddr).balanceOf(address(this));
        // aBal is aToken amount (aToken has same decimals as token). For Aave v3, aToken.balanceOf(this) equals underlying amount
        // We also track principal in `deposited`
        if (aBal > deposited) {
            uint256 profit = aBal - deposited;
            // withdraw profit amount from pool to this contract and transfer to vault
            uint256 out = pool.withdraw(address(token), profit, address(this));
            token.safeTransfer(vault, out);
            // deposited remains same (we didn't remove principal)
        }
    }

    function strategyBalance() public view override returns (uint256) {
        return pool.getUnderlyingValue(address(this), address(token));
    }


    // --- safe no-op deleverage for non-leverage strategies ---
    function deleverageAll(uint256 /*maxLoops*/) external override onlyRouter {
        // This strategy doesn't borrow; nothing to do.
        // Keep as no-op so Router can call deleverageAll uniformly.
        return;
    }
    
}
