// utils/bigint.ts

// Recursively convert BigInt / BigNumber-like values -> strings
export function toStringBN(value: any): any {
    if (typeof value === "bigint") return value.toString();
    if (value && typeof value === "object" && value._isBigNumber) return value.toString(); // ethers BigNumber
    if (Array.isArray(value)) return value.map(v => toStringBN(v));
    if (value && typeof value === "object") {
      const out: any = {};
      for (const k of Object.keys(value)) out[k] = toStringBN(value[k]);
      return out;
    }
    return value;
  }
  
  // Format a value (string or bigint) as 18-decimal human readable string
  export function format18(raw: string | bigint): string {
    const s = typeof raw === "bigint" ? raw.toString() : String(raw);
    // remove any non-digit leading characters
    const onlyDigits = s.startsWith("-") ? s.slice(1) : s.replace(/[^0-9]/g, "");
    const neg = s.startsWith("-");
    const padded = onlyDigits.padStart(19, "0"); // ensure at least 19 to produce x.xxx
    const intPart = padded.slice(0, padded.length - 18);
    const fracPart = padded.slice(-18);
    return (neg ? "-" : "") + `${intPart}.${fracPart}`;
  }
  