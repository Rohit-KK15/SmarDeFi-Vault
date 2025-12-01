// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategy.sol";
import "hardhat/console.sol";

interface IVault {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);

    function moveToStrategy(address strategy, uint256 amount) external;
    function receiveFromStrategy(uint256 amount) external;
    function handleHarvestProfit(uint256 profit) external;
}

contract StrategyRouter is Ownable {

    // Vault that holds the tokens
    IVault public immutable vault;

    // Strategy list
    address[] public strategies;

    // Allocation targets in basis points (10000 = 100%)
    mapping(address => uint256) public targetBps;

    event StrategiesUpdated();
    event Rebalanced(uint256 totalManaged);
    event Harvested(address indexed strat, uint256 profit);
    event WithdrawnFromStrategies(uint256 requested, uint256 pulled);
    event DeleverageTriggered(address indexed strat, uint256 maxLoops);
    event StrategyWithdrawFailed(address indexed strat, string reason);

    constructor(address _vault, address _owner) Ownable(_owner) {
        require(_vault != address(0), "vault=0");
        vault = IVault(_vault);
    }

    // ------------------------------------------------------------
    //  STRATEGY MANAGEMENT
    // ------------------------------------------------------------

    function setStrategies(address[] calldata _strats, uint256[] calldata _bps)
        external
        onlyOwner
    {
        require(_strats.length == _bps.length, "len mismatch");

        delete strategies;

        uint256 total;
        for (uint256 i = 0; i < _strats.length; i++) {
            require(_strats[i] != address(0), "zero strat");
            strategies.push(_strats[i]);
            targetBps[_strats[i]] = _bps[i];
            total += _bps[i];
        }

        require(total == 10000, "targets must sum 10000");

        emit StrategiesUpdated();
    }

    function getStrategies() external view returns (address[] memory) {
        return strategies;
    }

    function getStrategyStats(address strat)
        external view
        returns (
            uint256 balance,
            uint256 target,
            uint256 actualPct
        )
    {
        balance = IStrategy(strat).strategyBalance();
        target = targetBps[strat];
        uint256 total = _computeTotalManaged();
        actualPct = total == 0 ? 0 : (balance * 10000) / total;
    }

    function getPortfolioState()
        external view
        returns (address[] memory strats, uint256[] memory balances, uint256[] memory targets)
    {
        strats = strategies;
        balances = new uint256[](strats.length);
        targets  = new uint256[](strats.length);

        uint256 total = _computeTotalManaged();

        for (uint256 i = 0; i < strats.length; i++) {
            balances[i] = IStrategy(strats[i]).strategyBalance();
            targets[i]  = targetBps[strats[i]];
        }
    }

    // function aiRebalance() external onlyOwner {
    //     rebalance();
    // }




    function moveFundsToStrategy(address strat, uint256 amount) external onlyOwner {
        require(amount > 0, "zero amount");

        // vault → strategy
        console.log("Moving LINK from Vault to Strategy....");
        vault.moveToStrategy(strat, amount);
        console.log("LINK moved to strategy");

        // strategy invests (wrap in try/catch so a failing invest doesn't revert router permanently)
        try IStrategy(strat).invest(amount) {
            // success
        } catch {
            // investment may revert; emit and continue (caller/owner should inspect)
            emit StrategyWithdrawFailed(strat, "invest failed");
        }
    }

    function moveAllToStrategy(address strat) external onlyOwner {
        uint256 bal = vault.totalAssets();
        require(bal > 0, "no assets");
        vault.moveToStrategy(strat, bal);
        try IStrategy(strat).invest(bal) {
        } catch {
            emit StrategyWithdrawFailed(strat, "invest failed");
        }
    }

    /// Called by Vault when it needs `amount` tokens back to satisfy a user withdrawal.
    /// The router will iterate strategies and ask them to `withdrawToVault(needed)` until
    /// the requested amount is satisfied or strategies are exhausted.
    function withdrawFromStrategies(uint256 amount) external returns (uint256){
        require(msg.sender == address(vault), "not vault");
        require(amount > 0, "zero amount");

        IERC20 asset = IERC20(vault.asset());
        uint256 pulled = 0;
        uint256 requested = amount;

        for (uint256 i = 0; i < strategies.length && pulled < requested; i++) {
            address strat = strategies[i];
            uint256 need = requested - pulled;

            uint256 before = asset.balanceOf(address(vault));

            // call withdraw on strategy — some strategies return uint, some don't; use try/catch and measure vault balance delta
            try IStrategy(strat).withdrawToVault(need) {
                // success path (we will measure delta below)
            } catch (bytes memory reason) {
                // record failure but continue to next strategy
                string memory msgStr = _decodeRevertReason(reason);
                emit StrategyWithdrawFailed(strat, msgStr);
                continue;
            }

            uint256 afterBal = asset.balanceOf(address(vault));
            uint256 got = 0;
            if (afterBal > before) got = afterBal - before;
            pulled += got;
        }

        emit WithdrawnFromStrategies(requested, pulled);

        require(pulled >= requested, "strategies insufficient");

        return pulled;
    }

    // ------------------------------------------------------------
    //  REBALANCE LOGIC
    // ------------------------------------------------------------

    function rebalance() external onlyOwner {
        uint256 totalManaged = _computeTotalManaged();

        // Pull excess from overweight strategies
        for (uint256 i = 0; i < strategies.length; i++) {
            address strat = strategies[i];
            uint256 current = IStrategy(strat).strategyBalance();
            uint256 desired = (totalManaged * targetBps[strat]) / 10000;

            if (current > desired) {
                uint256 excess = current - desired;

                // strategy → vault
                IStrategy(strat).withdrawToVault(excess);
                vault.receiveFromStrategy(excess);
            }
        }

        // Push to underweight strategies
        uint256 vaultBal = vault.totalAssets();

        for (uint256 i = 0; i < strategies.length; i++) {
            address strat = strategies[i];
            uint256 current = IStrategy(strat).strategyBalance();
            uint256 desired = (totalManaged * targetBps[strat]) / 10000;

            if (current < desired && vaultBal > 0) {
                uint256 need = desired - current;
                uint256 amt = need <= vaultBal ? need : vaultBal;

                // vault → strategy
                vault.moveToStrategy(strat, amt);
                IStrategy(strat).invest(amt);

                vaultBal -= amt;
            }
        }

        emit Rebalanced(totalManaged);
    }

    // ------------------------------------------------------------
    //  HELPERS
    // ------------------------------------------------------------

    function _computeTotalManaged() internal view returns (uint256 total) {
        total = vault.totalAssets();
        for (uint256 i = 0; i < strategies.length; i++) {
            total += IStrategy(strategies[i]).strategyBalance();
        }
    }

    // allow owner to instruct a strategy to unwind/deleverage
    function triggerDeleverage(address strat, uint256 maxLoops) external onlyOwner {
        require(strat != address(0), "zero strat");
        // call deleverageAll in try/catch
        try IStrategy(strat).deleverageAll(maxLoops) {
            emit DeleverageTriggered(strat, maxLoops);
        } catch (bytes memory reason) {
            emit StrategyWithdrawFailed(strat, _decodeRevertReason(reason));
        }
    }

    // ------------------------------------------------------------
    //  HARVESTING
    // ------------------------------------------------------------

    function harvestAll() external onlyOwner {
        address[] memory list = strategies;

        for (uint256 i = 0; i < list.length; i++) {
            address strat = list[i];

            uint256 beforeBal = vault.totalAssets();

            // Trigger strategy harvest (strategy sends profit to vault). tolerate failures.
            try IStrategy(strat).harvest() {
            } catch (bytes memory reason) {
                emit StrategyWithdrawFailed(strat, _decodeRevertReason(reason));
                continue;
            }

            uint256 afterBal = vault.totalAssets();

            if (afterBal > beforeBal) {
                uint256 profit = afterBal - beforeBal;
                // Vault will apply the fee internally
                vault.handleHarvestProfit(profit);

                emit Harvested(strat, profit);
            }
        }
    }


        // Utility: decode revert bytes to string when possible
    function _decodeRevertReason(bytes memory reason) internal pure returns (string memory) {
        // If reason starts with Error(string) selector, decode; else return hex snippet
        if (reason.length >= 4) {
            // standard Error(string) selector = 0x08c379a0
            bytes4 selector;
            assembly { selector := mload(add(reason, 32)) }
            if (selector == 0x08c379a0) {
                // decode string
                // skip selector and offset/length (first 4 + 32 + 32)
                bytes memory str;
                assembly {
                    // load length from offset 36 (0x24)
                    let strLen := mload(add(reason, 100))
                    // allocate
                    str := mload(0x40)
                    mstore(str, strLen)
                    // copy data
                    let dataPtr := add(reason, 164)
                    let destPtr := add(str, 32)
                    for { let i := 0 } lt(i, strLen) { i := add(i, 32) } {
                        mstore(add(destPtr, i), mload(add(dataPtr, i)))
                    }
                    // update free memory pointer
                    mstore(0x40, add(destPtr, 32))
                }
                return string(str);
            }
        }
        // fallback: return short hex
        return "revert";
    }


}
