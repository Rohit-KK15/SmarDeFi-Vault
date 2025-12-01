// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

interface IStrategyRouter {
    function getStrategies() external view returns (address[] memory);
    function withdrawFromStrategies(uint256) external;
}

interface IStrategy {
    function strategyBalance() external view returns (uint256);
}


contract Vault is ERC20, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    uint256 public performanceFeeBps; // e.g., 1000 = 10%
    address public feeRecipient;


    event Deposit(address indexed user, uint256 amount, uint256 shares);
    event Withdraw(address indexed user, uint256 amount, uint256 shares);

    constructor(address _asset, address _feeRecipient, uint256 _bps)
        ERC20("Vault Share Token", "VST")
        Ownable(msg.sender)
    {
        asset = IERC20(_asset);
        feeRecipient = _feeRecipient;
        performanceFeeBps = _bps;
    }

    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function getNAV() external view returns (uint256) {
        return totalManagedAssets();
    }

    function availableLiquidity() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 s = totalSupply();
        return s == 0 ? assets : (assets * s) / totalManagedAssets();
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 s = totalSupply();
        return s == 0 ? shares : (shares * totalManagedAssets()) / s;
    }

    function deposit(uint256 amount) external returns (uint256) {
        asset.safeTransferFrom(msg.sender, address(this), amount);
        uint256 shares = convertToShares(amount);
        _mint(msg.sender, shares);
        emit Deposit(msg.sender, amount, shares);
        return shares;
    }

    function withdraw(uint256 shares) external returns (uint256 assetsOut) {
        require(shares > 0, "zero shares");
        require(balanceOf(msg.sender) >= shares, "not enough shares");

        uint256 totalAssetsBefore = totalManagedAssets();

        // 1. Calculate assets owed
        assetsOut = convertToAssets(shares);
        require(assetsOut > 0, "zero assets out");

        // 2. Burn shares
        _burn(msg.sender, shares);

        // 3. Check vault liquidity
        uint256 vaultBal = asset.balanceOf(address(this));

        if (vaultBal < assetsOut) {
            // 4. Pull from strategies via router
            uint256 needed = assetsOut - vaultBal;

            require(router != address(0), "router not set");

            // router should pull funds → strategies must transfer back to vault
            IStrategyRouter(router).withdrawFromStrategies(needed);

            uint256 newVaultBal = asset.balanceOf(address(this));
            require(newVaultBal >= assetsOut, "not enough liquidity after pull");
        }

        // 5. Transfer assets to user
        asset.safeTransfer(msg.sender, assetsOut);

        emit Withdraw(msg.sender, assetsOut, shares);
    }


    // ─────────────────────────────────────────────
    //   STRATEGY ROUTER ACCESS (ONLY ROUTER)
    // ─────────────────────────────────────────────
    address public router;

    function setRouter(address _router) external onlyOwner {
        router = _router;
    }

    modifier onlyRouter() {
        require(msg.sender == router, "not router");
        _;
    }

    // router moves funds FROM vault → to strategy
    function moveToStrategy(address strategy, uint256 amount) external onlyRouter {
        console.log("Approving ", amount," to StrategyUniV3....");
        asset.approve(strategy, amount);
        console.log("Transferring LINK from Vault to StrategyUniV3....");
        asset.safeTransfer(strategy, amount);
        console.log("Transfer Successfull in Vault.sol...");
    }

    // router pulls funds FROM strategy → to vault
    function receiveFromStrategy(uint256 amount) external onlyRouter {
        // strategies call asset.transfer(vault, amount)
        // the vault doesn't pull manually — it just expects transfer
        // this function exists only for router-triggered accounting
    }

    function handleHarvestProfit(uint256 profit) external {
        require(msg.sender == router, "not router");

        if (profit == 0) return;

        uint256 fee = (profit * performanceFeeBps) / 10000;

        if (fee > 0) {
            asset.safeTransfer(feeRecipient, fee);
        }
    }


    function totalManagedAssets() public view returns (uint256) {
        uint256 total = asset.balanceOf(address(this));

        if (router != address(0)) {
            address[] memory strats = IStrategyRouter(router).getStrategies();

            for (uint256 i = 0; i < strats.length; i++) {
                total += IStrategy(strats[i]).strategyBalance();
            }
        }

        return total;
    }

}
