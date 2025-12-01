// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// Minimal imports
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IProtocolDataProvider.sol";

interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);

    function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode) external;
    function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) external returns (uint256);
    function getUnderlyingValue(address user, address token) external view returns (uint256);
    function getUserDebt(address user, address token) external view returns (uint256);
}

/// UniswapV2-style router interface (replace if you use different router)
interface ISwapRouterV2 {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

contract StrategyAaveLeverage is IStrategy {
    using SafeERC20 for IERC20;

    // immutable core
    IERC20 public immutable token; // LINK (underlying)
    address public immutable vault;
    address public immutable router; // StrategyRouter
    IPool public immutable pool;
    IProtocolDataProvider public immutable dataProvider;

    // swap
    ISwapRouterV2 public immutable swapRouter;
    address public immutable WETH;

    // bookkeeping
    uint256 public deposited; // total principal deposited by vault (for accounting)
    uint256 public borrowedWETH; // track WETH borrowed (approx)

    // leverage params (configurable by router/owner)
    uint8 public maxDepth = 3;        // maximum loop iterations allowed
    uint256 public borrowFactor = 6000; // parts-per-10000: e.g., 6000 => borrow 60% of collateral at each loop (conservative)
    // Note: borrowFactor should be < Aave's LTV and include safety margin.

    // access control
    modifier onlyRouter() {
        require(msg.sender == router, "not router");
        _;
    }

    // operational pause
    bool public paused;

    event InvestedLeveraged(uint256 initial, uint8 depth, uint256 finalSupplied, uint256 borrowedWETH);
    event Deleveraged(uint256 repaidWETH, uint256 redeemedLINK);
    event Harvested(uint256 profit);
    event PauseToggled(bool paused);
    event LeverageParamsUpdated(uint8 maxDepth, uint256 borrowFactor);
    event DBG(string msg, uint256 v1, uint256 v2);
    event DBG_ADDR(string msg, address a);

    constructor(
        address _asset,
        address _vault,
        address _router,
        address _pool,
        address _dataProvider,
        address _swapRouter,
        address _weth
    ) {
        token = IERC20(_asset);
        vault = _vault;
        router = _router;
        pool = IPool(_pool);
        dataProvider = IProtocolDataProvider(_dataProvider);
        swapRouter = ISwapRouterV2(_swapRouter);
        WETH = _weth;

        // safe approvals: we only approve tokens that exist; using SafeERC20
        // approve token -> pool (for supplying LINK)
        token.approve(address(pool), type(uint256).max);
        // approve WETH -> swapRouter (for swapping borrowed WETH)
        IERC20(_weth).approve(address(swapRouter), type(uint256).max);
    }

    // --- governance / router setters ---
    function setLeverageParams(uint8 _maxDepth, uint256 _borrowFactor) external onlyRouter {
        require(_maxDepth <= 6, "maxDepth too large"); // safety cap
        require(_borrowFactor <= 8000, "borrowFactor too high"); // <= 80% safety cap
        maxDepth = _maxDepth;
        borrowFactor = _borrowFactor;
        emit LeverageParamsUpdated(_maxDepth, _borrowFactor);
    }

    function getLeverageState()
        external view
        returns (
            uint256 deposited_,
            uint256 borrowed_,
            uint256 netExposure,
            uint256 loops,
            uint8 maxDepth_
        )
    {
        deposited_ = deposited;
        borrowed_ = borrowedWETH;
        netExposure = deposited_ > borrowed_ ? deposited_ - borrowed_ : 0;
        loops = maxDepth;
        maxDepth_ = maxDepth;
    }

    function getLTV() external view returns (uint256) {
        if (deposited == 0) return 0;
        return (borrowedWETH * 1e18) / deposited; // 1e18 = 100%
    }

    function isAtRisk(uint256 maxSafeLTV) external view returns (bool) {
        uint256 ltv = (borrowedWETH * 1e18) / deposited;
        return ltv > maxSafeLTV;
    }



    function togglePause() external onlyRouter {
        paused = !paused;
        emit PauseToggled(paused);
    }

    // Allow contract to accept plain ETH calls and avoid accidental revert during ERC20 transfer (safe)
    receive() external payable {}
    fallback() external payable {}

    // --- IStrategy implementation ---
    /// invest: vault must have transferred `amount` tokens to this contract (via vault.moveToStrategy)
    /// We perform a conservative leveraging loop that avoids impossible borrows on low-liquidity testnets.
    function invest(uint256 amount) external override onlyRouter {
        require(!paused, "paused");
        require(amount > 0, "zero amount");

        // We'll use the token balance on the contract for safety (in case of slight differences)
        uint256 bal = token.balanceOf(address(this));
        require(bal >= amount, "insufficient token in strat");

        // initial supply
        pool.supply(address(token), amount, address(this), 0);

        // total supplied tracked in token units (LINK)
        uint256 totalSupplied = amount;

        // loop depth
        uint8 depth = maxDepth;

        uint256 totalBorrowedWETH = 0;

        // conservative constants (adjust if needed)
        // tiny default borrow: 0.001 WETH (in wei)
        uint256 tinyBorrow = 1e15; // 0.001 WETH
        // safety: don't borrow more than this fraction of pool WETH (e.g., 1%)
        uint256 poolFractionDenominator = 100;

        for (uint8 i = 0; i < depth; i++) {
            // 1) check WETH liquidity in Aave pool
            uint256 poolWethBal = IERC20(WETH).balanceOf(address(pool));
            if (poolWethBal == 0) break;

            // 2) compute a safe borrow: min(tinyBorrow, poolWethBal / poolFractionDenominator)
            uint256 capFromPool = poolWethBal / poolFractionDenominator; // e.g., 1% of pool
            uint256 borrowAmountWeth = tinyBorrow;
            if (capFromPool > 0 && capFromPool < borrowAmountWeth) {
                borrowAmountWeth = capFromPool;
            }

            // final safety: ensure borrowAmountWeth non-zero
            if (borrowAmountWeth == 0) break;

            // 3) borrow WETH (variable rate mode = 2) - wrap in try/catch to avoid reverting whole invest
            try pool.borrow(WETH, borrowAmountWeth, 2, 0) {
                // ok
            } catch {
                // borrow failed — stop further loops
                break;
            }
            totalBorrowedWETH += borrowAmountWeth;

            // 4) swap WETH -> LINK using router (v2 style swapExactTokensForTokens)
            // prepare path
            address[] memory path = new address[](2);
            path[0] = WETH;
            path[1] = address(token);

            // record LINK balance before swap
            uint256 linkBefore = token.balanceOf(address(this));

            // perform swap (amountOutMin = 0 for demo; in prod set slippage protection)
            bool swapOk = true;
            try swapRouter.swapExactTokensForTokens(borrowAmountWeth, 0, path, address(this), block.timestamp + 300) returns (uint[] memory amounts) {
                // ok
            } catch {
                swapOk = false;
            }

            // If swap failed, attempt to repay borrowed WETH and stop
            if (!swapOk) {
                // attempt best-effort repay using any WETH we might have (if any)
                uint256 wethBal = IERC20(WETH).balanceOf(address(this));
                if (wethBal > 0) {
                    try pool.repay(WETH, wethBal, 2, address(this)) {
                        // ignore result
                    } catch { }
                }
                break;
            }

            // LINK received from swap
            uint256 linkAfter = token.balanceOf(address(this));
            uint256 addedLink = 0;
            if (linkAfter > linkBefore) {
                addedLink = linkAfter - linkBefore;
            }

            // if we received nothing, attempt to repay and stop looping to avoid waste
            if (addedLink == 0) {
                uint256 wethBal2 = IERC20(WETH).balanceOf(address(this));
                if (wethBal2 > 0) {
                    try pool.repay(WETH, wethBal2, 2, address(this)) {
                        // ignore
                    } catch { }
                }
                break;
            }

            // 5) supply the received LINK into Aave (wrap in try/catch)
            try pool.supply(address(token), addedLink, address(this), 0) {
                // ok
            } catch {
                // if supply failed for some reason, try to unwind by swapping back and repaying
                // attempt best-effort repay
                uint256 wethBal3 = IERC20(WETH).balanceOf(address(this));
                if (wethBal3 > 0) {
                    try pool.repay(WETH, wethBal3, 2, address(this)) { } catch { }
                }
                break;
            }

            // update bookkeeping
            totalSupplied += addedLink;
        }

        // bookkeeping
        deposited += amount;
        borrowedWETH += totalBorrowedWETH;

        emit InvestedLeveraged(amount, depth, totalSupplied, totalBorrowedWETH);
    }

    /// withdraw specified amount of underlying to vault (tries to redeem from Aave)
    function withdrawToVault(uint256 amount) external override onlyRouter returns(uint256){
        require(amount > 0, "zero amount");

        // Attempt to redeem `amount` LINK from Aave
        uint256 out = pool.withdraw(address(token), amount, address(this));

        // transfer to vault
        token.safeTransfer(vault, out);

        if (out <= deposited) deposited -= out;
        else deposited = 0;

        return out;
    }

    /// harvest: withdraw profits (amount over `deposited`) and send to vault
    function harvest() external override onlyRouter {
        // get aToken address & balance
        (address aTokenAddr, , ) = dataProvider.getReserveTokensAddresses(address(token));
        uint256 aBal = IERC20(aTokenAddr).balanceOf(address(this));

        if (aBal > deposited) {
            uint256 profit = aBal - deposited;
            uint256 out = pool.withdraw(address(token), profit, address(this));
            token.safeTransfer(vault, out);
            emit Harvested(out);
        }
    }

    /// deleverage: unwinds borrow by withdrawing LINK -> swapping LINK->WETH -> repay in loop
    function deleverageAll(uint256 maxLoops) external onlyRouter {
        require(!paused, "paused");

        for (uint256 i = 0; i < maxLoops; i++) {
            uint256 debt = pool.getUserDebt(address(this), WETH);
            if (debt == 0) break;

            // --------------------------------------------------------------------
            // 1. Withdraw enough LINK from Aave to repay outstanding WETH debt
            // --------------------------------------------------------------------
            uint256 withdrawAmt = deposited > debt ? debt : deposited;
            if (withdrawAmt == 0) break;

            uint256 gotLINK = pool.withdraw(address(token), withdrawAmt, address(this));
            if (gotLINK == 0) break;

            // --------------------------------------------------------------------
            // 2. Swap LINK → WETH
            // --------------------------------------------------------------------
            address[] memory path = new address[](2);
            path[0] = address(token);
            path[1] = WETH;

            uint256 linkBefore = token.balanceOf(address(this));
            uint256 wethBefore = IERC20(WETH).balanceOf(address(this));

            uint[] memory amounts = swapRouter.swapExactTokensForTokens(
                gotLINK,
                0,
                path,
                address(this),
                block.timestamp + 300
            );

            uint256 wethOut = IERC20(WETH).balanceOf(address(this)) - wethBefore;
            if (wethOut == 0) break;

            // --------------------------------------------------------------------
            // 3. Approve pool to pull WETH
            // --------------------------------------------------------------------
            IERC20(WETH).approve(address(pool), wethOut);

            // --------------------------------------------------------------------
            // 4. Repay debt
            // --------------------------------------------------------------------
            uint256 repaid = pool.repay(WETH, wethOut, 2, address(this));

            // Update bookkeeping
            if (borrowedWETH <= repaid) borrowedWETH = 0;
            else borrowedWETH -= repaid;

            if (deposited <= withdrawAmt) deposited = 0;
            else deposited -= withdrawAmt;
        }
    }



    function strategyBalance() public view override returns (uint256) {
        return pool.getUnderlyingValue(address(this), address(token));
    }

}
