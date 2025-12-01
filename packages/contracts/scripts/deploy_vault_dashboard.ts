import { ethers, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // 1. Use Real LINK Token (Sepolia)
    const linkAddress = "0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5";
    console.log("Using existing LINK Token at:", linkAddress);

    // 2. Deploy Vault
    // Constructor: address _asset, address _feeRecipient, uint256 _bps
    const feeRecipient = deployer.address;
    const performanceFeeBps = 1000; // 10%

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy(linkAddress, feeRecipient, performanceFeeBps);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("Vault deployed to:", vaultAddress);

    console.log("\n--- Deployment Summary ---");
    console.log("LINK Token:", linkAddress);
    console.log("Vault:", vaultAddress);

    // 3. Write to Web App Constants
    const webAppDir = path.join(__dirname, "../../web/defi-portfolio-app");
    const libDir = path.join(webAppDir, "lib");

    if (!fs.existsSync(libDir)) {
        fs.mkdirSync(libDir, { recursive: true });
    }

    const vaultArtifact = artifacts.readArtifactSync("Vault");

    // Try to find ERC20 artifact, otherwise fallback to empty ABI (should not happen if compiled)
    let linkAbi: any[] = [];
    try {
        // Vault imports SafeERC20 which imports IERC20, so we might have it.
        // Or we can try to get it from @openzeppelin
        const artifact = await artifacts.readArtifact("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20");
        linkAbi = artifact.abi;
    } catch (e) {
        console.warn("Could not find ERC20 artifact, trying IERC20...");
        try {
            const artifact = await artifacts.readArtifact("IERC20");
            linkAbi = artifact.abi;
        } catch (e2) {
            console.warn("Could not find IERC20 artifact either. Using minimal ABI.");
            linkAbi = [
                "function balanceOf(address owner) view returns (uint256)",
                "function decimals() view returns (uint8)",
                "function symbol() view returns (string)",
                "function transfer(address to, uint256 amount) returns (bool)",
                "function approve(address spender, uint256 amount) returns (bool)",
                "function allowance(address owner, address spender) view returns (uint256)"
            ];
        }
    }

    const constantsContent = `
export const VAULT_ADDRESS = "${vaultAddress}";
export const LINK_ADDRESS = "${linkAddress}";

export const VAULT_ABI = ${JSON.stringify(vaultArtifact.abi, null, 2)} as const;
export const LINK_ABI = ${JSON.stringify(linkAbi, null, 2)} as const;
`;

    fs.writeFileSync(path.join(libDir, "constants.ts"), constantsContent);
    console.log("Written constants to web app");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
