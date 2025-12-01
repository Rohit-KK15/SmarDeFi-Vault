import { ethers } from "hardhat";

async function main() {
    const[deployer] = await ethers.getSigners();
    const user = deployer;
    const vault = await ethers.getContractAt("Vault", "");
    const link = await ethers.getContractAt("MockERC20", ""); // now LINK
    const regStrat = await ethers.getContractAt("StrategyAaveV3", "");
    const levStrat = await ethers.getContractAt("StrategyAaveLeverage", "");
    const router = await ethers.getContractAt("StrategyRouter", "");
    const shares = await vault.balanceOf(user);
    console.log("StrategyAaveV3 Bal: ", await regStrat.strategyBalance());
    console.log("StrategyAaveLeverage Bal: ", await levStrat.strategyBalance());
    console.log("User Shares: ", shares);
    console.log("LINK value of Shares: ", await vault.convertToAssets(shares));
    console.log("Vault Total Managed Assets in LINK: ", ethers.formatUnits(await vault.totalManagedAssets(), 18));
    console.log("Present Debt: ", await levStrat.borrowedWETH());
    console.log("triggering delevaregAll()....");
    // await router.triggerDeleverage(await levStrat.getAddress(), 10);
    // console.log("Successfully Deleraged!");

    // console.log("vault totalAssets:", ethers.formatUnits((await vault.totalAssets()), 18).toString());
    // console.log("vault shares (totalSupply):", ethers.formatUnits((await vault.totalSupply()), 18).toString());
    // console.log("user shares:", ethers.formatUnits((await vault.balanceOf(user)), 18).toString());

    // const strat = await ethers.getContractAt("StrategyAaveV3", "0x7AAb9c720F76B85300e8c9E0429c93E04ed7A94e");
    // console.log("strategyBalance:", ethers.formatUnits((await strat.strategyBalance()), 18).toString());

    // const dp = await ethers.getContractAt("IProtocolDataProvider", "0x3e9708d80f7B3e43118013075F7e95CE3AB31F31");
    // const [aTokenAddr] = await dp.getReserveTokensAddresses(link.getAddress());
    // console.log("aToken:", aTokenAddr);
    // console.log("aToken.balanceOf(strategy):", ethers.formatUnits((await (await ethers.getContractAt("IERC20", aTokenAddr)).balanceOf(strat.getAddress())), 18).toString());

    // console.log("Withdrawing User's vault shares.......");
    // await (await vault.connect(user).withdraw(2500000000000000000n)).wait();
    // console.log("Withdraw Successfull");

    // const linkk = await ethers.getContractAt("IERC20", link);
    // const balBefore = await linkk.balanceOf(user.address);
    // console.log("User LINK before deposit:", ethers.formatUnits(balBefore, 18));

    // const router = await ethers.getContractAt("StrategyRouter", "0x39f0e114a31387e9fB4F0dF8D23850AA0cC10Ef8");
    // await (await router.connect(deployer).harvestAll()).wait();

    // console.log("vault totalAssets:", ethers.formatUnits((await vault.totalAssets()), 18).toString());
    // console.log("strategyBalance:", ethers.formatUnits((await strat.strategyBalance()), 18).toString());

}

main().catch((err) => {
    console.error(err);
    process.exit(1);
  });