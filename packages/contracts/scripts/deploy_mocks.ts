// scripts/deploy_mocks_final.ts
import { ethers } from "hardhat";
import dotenv from "dotenv";
dotenv.config();

async function decodeRevertData(data?: string | null) {
  try {
    if (!data || data === "0x") return null;
    return ethers.toUtf8String("0x" + data.slice(138));
  } catch {
    return null;
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n=== DEPLOY & DEMO (MOCKS) ===\n");
  console.log("Deployer:", deployer.address);

  const parseU = (v: string) => ethers.parseUnits(v, 18);

  // -------------------------
  // 1) Deploy Mock tokens
  // -------------------------
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const link = await MockERC20.deploy("LINK", "LINK");
  await link.waitForDeployment();
  const weth = await MockERC20.deploy("WETH", "WETH");
  await weth.waitForDeployment();
  console.log("Mock LINK:", await link.getAddress());
  console.log("Mock WETH:", await weth.getAddress());

  // mint initial balances to deployer for demo
  await (await link.mint(deployer.address, parseU("100000"))).wait();
  await (await weth.mint(deployer.address, parseU("1000"))).wait();
  console.log("Minted LINK/WETH to deployer.");

  // -------------------------
  // 2) Deploy MockPriceOracle (optional)
  // -------------------------
  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
  // 1 WETH = 100 LINK
  const oracle = await MockPriceOracle.deploy(parseU("100"));
  await oracle.waitForDeployment();
  console.log("MockPriceOracle:", await oracle.getAddress());

  // -------------------------
  // 3) Deploy MockAavePoolB (yield-enabled)
  // -------------------------
  const MockPool = await ethers.getContractFactory("MockAavePoolB");
  const pool = await MockPool.deploy();
  await pool.waitForDeployment();
  console.log("MockAavePoolB:", await pool.getAddress());

  // init reserves for LINK and WETH: supplyApy 10% (0.10), borrowApy 12% (0.12)
  await (await pool.initReserve(await link.getAddress(), ethers.parseUnits("0.10", 18), ethers.parseUnits("0.12", 18))).wait();
  await (await pool.initReserve(await weth.getAddress(), ethers.parseUnits("0.05", 18), ethers.parseUnits("0.06", 18))).wait();
  console.log("Reserves init done.");

  // fetch aToken addresses from pool
  const linkReserve = await pool.getReserveTokensAddresses(await link.getAddress());
  const linkAToken = linkReserve[0];
  const wethAToken = (await pool.getReserveTokensAddresses(await weth.getAddress()))[0];
  console.log("link aToken:", linkAToken);
  console.log("weth aToken:", wethAToken);

  // -------------------------
  // 4) Deploy MockSwapRouterV2 (no constructor args)
  // -------------------------
  const MockSwap = await ethers.getContractFactory("MockSwapRouterV2");
  const swap = await MockSwap.deploy();
  await swap.waitForDeployment();
  console.log("MockSwapRouterV2:", await swap.getAddress());

  // Fund pool and router with tokens so swaps/borrows succeed
  // transfer some WETH to pool so borrowers can borrow
  await (await weth.transfer(await pool.getAddress(), parseU("50"))).wait();
  // fund swap router with LINK liquidity for swaps (seed later as well)
  await (await link.transfer(await swap.getAddress(), parseU("20000"))).wait();

  // -------------------------
  // 5) Deploy MockProtocolDataProvider
  // -------------------------
  const MockPDP = await ethers.getContractFactory("MockProtocolDataProvider");
  const pdp = await MockPDP.deploy();
  await pdp.waitForDeployment();
  // set aToken mapping for LINK and WETH
  await (await pdp.setAToken(await link.getAddress(), linkAToken)).wait();
  await (await pdp.setAToken(await weth.getAddress(), wethAToken)).wait();
  console.log("MockProtocolDataProvider:", await pdp.getAddress());

  // -------------------------
  // 6) Deploy Vault + StrategyRouter + Strategies
  // -------------------------
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(await link.getAddress(), deployer.address, 1000); // 10% perf fee
  await vault.waitForDeployment();
  console.log("Vault:", await vault.getAddress());

  const Router = await ethers.getContractFactory("StrategyRouter");
  const router = await Router.deploy(await vault.getAddress(), deployer.address);
  await router.waitForDeployment();
  console.log("StrategyRouter:", await router.getAddress());

  // set router in vault (safe set)
  await (await vault.setRouter(await router.getAddress())).wait();
  console.log("Vault.router set.");

  // Strategies factories
  const StratAave = await ethers.getContractFactory("StrategyAaveV3");
  const stratAave = await StratAave.deploy(
    await link.getAddress(),
    await vault.getAddress(),
    await router.getAddress(),
    await pool.getAddress(),
    await pdp.getAddress()
  );
  await stratAave.waitForDeployment();
  console.log("StrategyAaveV3:", await stratAave.getAddress());

  const StratLev = await ethers.getContractFactory("StrategyAaveLeverage");
  const stratLev = await StratLev.deploy(
    await link.getAddress(),
    await vault.getAddress(),
    await router.getAddress(),
    await pool.getAddress(),
    await pdp.getAddress(),
    await swap.getAddress(),
    await weth.getAddress()
  );
  await stratLev.waitForDeployment();
  console.log("StrategyAaveLeverage:", await stratLev.getAddress());

  // 7) Register strategies (80% lev, 20% aave)
  await (await router.setStrategies([await stratLev.getAddress(), await stratAave.getAddress()], [8000, 2000])).wait();
  console.log("Strategies set in router");

  // -------------------------
  // 8) Approve + deposit LINK to vault (5 LINK)
  // -------------------------
  const depositAmount = parseU("5");
  // approve vault to pull LINK from deployer
  await (await link.approve(await vault.getAddress(), parseU("1000"))).wait();
  await (await vault.deposit(depositAmount)).wait();
  console.log("Deposited to vault:", depositAmount.toString());

  console.log("Vault LINK balance:", (await link.balanceOf(await vault.getAddress())).toString());
  console.log("Vault totalAssets():", (await vault.totalAssets()).toString());

  // -------------------------
  // 9) Rebalance -> allocate funds to strategies
  // -------------------------
  console.log("\nCalling router.rebalance() to allocate funds to strategies...");
  await (await router.rebalance()).wait();
  console.log("router.rebalance() done.");

  // -------------------------
  // 10) Simulate interest accrual (advance time / accrue)
  // -------------------------
  console.log("\nSimulating interest accrual...");
  await (await pool.accrue(await link.getAddress())).wait();
  await (await pool.accrue(await weth.getAddress())).wait();
  console.log("pool.accrue(token) called.");

  // read strategy exposures
  try {
    const levBal = await stratLev.strategyBalance();
    const aaveBal = await stratAave.strategyBalance();
    console.log("Leverage strategy aToken underlying exposure:", levBal.toString());
    console.log("Aave strategy exposure:", aaveBal.toString());
  } catch (e) {
    console.warn("Could not read strategyBalance()", e);
  }

  // -------------------------
  // 11) Harvest
  // -------------------------
  console.log("\nCalling router.harvestAll() ...");
  try {
    await (await router.harvestAll()).wait();
    console.log("harvestAll executed.");
  } catch (err: any) {
    console.warn("harvestAll failed:", await decodeRevertData(err.data || err.error?.data) || err.message);
  }

  // -------------------------
  // 12) Ensure swap router has liquidity for deleverage swaps
  // -------------------------
  console.log("\nSeeding swap router liquidity (LINK/WETH) ...");
  // the MockSwapRouterV2 has seedLiquidity(token, amount) which requires approve
  await (await link.approve(await swap.getAddress(), parseU("20000"))).wait();
  await (await weth.approve(await swap.getAddress(), parseU("100"))).wait();
  await (await swap.seedLiquidity(await link.getAddress(), parseU("20000"))).wait();
  await (await swap.seedLiquidity(await weth.getAddress(), parseU("50"))).wait();
  console.log("swap seeded.");

  // -------------------------
  // 13) Trigger deleverage via router.triggerDeleverage(...) (owner only)
  // -------------------------
  console.log("\nTriggering deleverage via router.triggerDeleverage(...)");
  try {
    await (await router.triggerDeleverage(await stratLev.getAddress(), 10)).wait();
    console.log("triggerDeleverage executed.");
  } catch (e: any) {
    console.warn("triggerDeleverage failed:", await decodeRevertData(e.data || e.error?.data) || e.message);
  }

  // -------------------------
  // 14) Withdraw test: withdraw half of deployer shares (if deployer still owns them)
  // -------------------------
  const myShares = await vault.balanceOf(deployer.address);
  const toWithdraw = myShares / 2n;
  if (toWithdraw > 0n) {
    console.log("\nWithdraw test: withdrawing half of deployer shares ...");
    try {
      await (await vault.withdraw(toWithdraw)).wait();
      console.log("Withdraw done.");
    } catch (e: any) {
      console.warn("Withdraw failed:", await decodeRevertData(e.data || e.error?.data) || e.message);
    }
  } else {
    console.log("No shares to withdraw.");
  }

  // -------------------------
  // 15) Final status outputs
  // -------------------------
  console.log("\nFINAL STATE:");
  console.log("Vault totalAssets():", (await vault.totalAssets()).toString());
  console.log("Vault LINK balance:", (await link.balanceOf(await vault.getAddress())).toString());
  console.log("StrategyLeverage.deposited:", (await stratLev.deposited()).toString());
  console.log("StrategyLeverage.borrowedWETH:", (await stratLev.borrowedWETH()).toString());

  // pool.getUserDebt(user, token) exists on MockAavePoolB
  try {
    const poolDebt = await pool.getUserDebt(await stratLev.getAddress(), await weth.getAddress());
    console.log("Pool user debt (lev):", poolDebt.toString());
  } catch (e) {
    console.warn("Could not fetch pool debt:", e);
  }

  console.log("\n=== SCRIPT COMPLETE ===\n");
}

main().catch((err) => {
  console.error("SCRIPT ERROR:", err);
  process.exit(1);
});
