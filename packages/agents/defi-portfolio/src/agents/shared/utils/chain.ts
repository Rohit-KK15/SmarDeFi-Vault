import { ethers } from "ethers";
import { env } from "../../../env";

const provider = new ethers.JsonRpcProvider(env.RPC_URL,{
chainId: 11155111,
name: "sepolia"  
});

// ❗ If you want write-access with private key:
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

export async function chain_read(contract: string, abi: any, method: string, args: any[] = []) {
  const c = new ethers.Contract(contract, abi, provider);
  return await c[method](...args);
}

export async function chain_write(contract: string, abi: any, method: string, args: any[] = []) {
  const c = new ethers.Contract(contract, abi, signer);

  // Estimate gas with 20–30% buffer
  let gasLimit;
  try {
    const estimate = await c[method].estimateGas(...args);
    gasLimit = estimate * 12n / 10n; // +20%
  } catch (err) {
    console.error("Gas estimation error:", err);
    throw err;
  }

  // Get current network fees
  const feeData = await provider.getFeeData();

  const tx = await c[method](...args, {
    gasLimit,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
  });

  // Wait for confirmation — catches revert reasons
  const receipt = await tx.wait();

  return {
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    nonce: tx.nonce,
    status: receipt.status,
    gasUsed: receipt.gasUsed.toString(),
  };
}



export function toStringBN(value: any): any {
    if (typeof value === "bigint") return value.toString();
  
    if (Array.isArray(value)) return value.map(v => toStringBN(v));
  
    if (value && typeof value === "object") {
      const out: any = {};
      for (const k in value) out[k] = toStringBN(value[k]);
      return out;
    }
  
    return value;
  }

export { provider };
