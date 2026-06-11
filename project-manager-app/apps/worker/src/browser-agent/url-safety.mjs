import { URL } from "node:url";

/**
 * Validates whether a URL is safe to be visited by the browser agent.
 * Blocks:
 * - Schemes other than http: and https:
 * - Loopback addresses (localhost, 127.0.0.1, ::1)
 * - Private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 * - Link-local addresses (169.254.169.254)
 * - Multicast and broadcast addresses
 * 
 * @param {string} urlStr - The URL string to validate
 * @returns {boolean} True if the URL is safe, false otherwise
 */
export function isUrlSafe(urlStr) {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    
    const host = url.hostname.toLowerCase();
    
    // Loopback hostnames
    if (host === "localhost" || host.endsWith(".localhost") || host === "loopback") {
      return false;
    }
    
    // Check for loopback and private IP addresses
    if (isPrivateOrLocalIp(host)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

function isPrivateOrLocalIp(host) {
  // Strip brackets from IPv6 host
  const cleanHost = host.startsWith("[") && host.endsWith("]")
    ? host.slice(1, -1)
    : host;

  // Is it IPv4?
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = cleanHost.match(ipv4Regex);
  if (ipv4Match) {
    const parts = ipv4Match.slice(1).map(Number);
    if (parts.some(p => p > 255)) return true; // Treat invalid IPs as unsafe
    
    const [p0, p1, p2, p3] = parts;
    
    // Loopback: 127.0.0.0/8
    if (p0 === 127) return true;
    
    // 0.0.0.0/8
    if (p0 === 0) return true;
    
    // Private Class A: 10.0.0.0/8
    if (p0 === 10) return true;
    
    // Private Class B: 172.16.0.0/12
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;
    
    // Private Class C: 192.168.0.0/16
    if (p0 === 192 && p1 === 168) return true;
    
    // Link-local: 169.254.0.0/16
    if (p0 === 169 && p1 === 254) return true;
    
    // Shared address space: 100.64.0.0/10
    if (p0 === 100 && p1 >= 64 && p1 <= 127) return true;
    
    // Broadcast / Multicast
    if (p0 >= 224) return true;
    
    return false;
  }

  // Is it IPv6?
  // IPv6 loopback: ::1
  if (cleanHost === "::1" || cleanHost === "0:0:0:0:0:0:0:1" || cleanHost === "::") {
    return true;
  }
  
  // Check IPv6 prefixes
  // Link-local (fe80::/10), Unique Local (fc00::/7)
  if (
    cleanHost.startsWith("fe8") || 
    cleanHost.startsWith("fe9") || 
    cleanHost.startsWith("fea") || 
    cleanHost.startsWith("feb")
  ) {
    return true;
  }
  if (cleanHost.startsWith("fc") || cleanHost.startsWith("fd")) {
    return true;
  }
  
  return false;
}
