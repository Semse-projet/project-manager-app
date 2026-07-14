import { lookup } from "node:dns/promises";
import { URL } from "node:url";

export class SecureNetworkGateway {
  static async isUrlSafe(urlStr: string): Promise<boolean> {
    try {
      const url = new URL(urlStr);
      if (url.protocol !== "http:" && url.protocol !== "https:") return false;

      const host = url.hostname.toLowerCase();
      if (host === "localhost" || host.endsWith(".localhost") || host === "loopback") return false;
      if (host === "127.0.0.1" || host === "::1" || host === "0.0.0.0" || host === "::") return false;

      // Resolve DNS to verify resolved IP address safety
      const { address } = await lookup(host);
      return SecureNetworkGateway.isIpSafe(address);
    } catch {
      return false;
    }
  }

  static isIpSafe(ip: string): boolean {
    // Blocks Loopback: 127.0.0.0/8, 0.0.0.0/8
    if (ip.startsWith("127.") || ip.startsWith("0.")) return false;
    
    // Blocks Private Class A: 10.0.0.0/8
    if (ip.startsWith("10.")) return false;

    // Blocks Private Class C: 192.168.0.0/16
    if (ip.startsWith("192.168.")) return false;

    // Blocks Link-local: 169.254.0.0/16
    if (ip.startsWith("169.254.")) return false;

    // Blocks Private Class B: 172.16.0.0/12
    const parts = ip.split(".").map(Number);
    if (parts.length === 4) {
      const p0 = parts[0];
      const p1 = parts[1];
      if (p0 === 172 && p1 >= 16 && p1 <= 31) return false;
      // Blocks Shared Address Space: 100.64.0.0/10
      if (p0 === 100 && p1 >= 64 && p1 <= 127) return false;
    }

    // Blocks Private IPv6 prefixes
    const ipLower = ip.toLowerCase();
    if (
      ipLower === "::1" ||
      ipLower === "::" ||
      ipLower.startsWith("fe8") ||
      ipLower.startsWith("fe9") ||
      ipLower.startsWith("fea") ||
      ipLower.startsWith("feb") ||
      ipLower.startsWith("fc") ||
      ipLower.startsWith("fd")
    ) {
      return false;
    }

    return true;
  }
}
