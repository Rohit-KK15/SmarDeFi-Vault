import { ethers } from "ethers";
import { env } from "../../../env";

const provider = new ethers.JsonRpcProvider(env.RPC_URL);

// ❗ If you want write-access with private key:
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

export async function chain_read(contract: string, abi: any, method: string, args: any[] = []) {
  const c = new ethers.Contract(contract, abi, provider);
  return await c[method](...args);
}

export async function chain_write(contract: string, abi: any, method: string, args: any[] = []) {
  const c = new ethers.Contract(contract, abi, signer);
  const tx = await c[method](...args);
  return await tx.wait();
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
