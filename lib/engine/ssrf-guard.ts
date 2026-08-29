import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Hard Constraint 8: the HTTP Request action makes a live outbound call, on a schedule or in
// response to arbitrary inbound data, using the account's own server. Treated as a real SSRF
// surface — before executing, resolve and reject requests targeting private/internal IP
// ranges, loopback, link-local, and the cloud metadata address.
//
// Pulled into its own module (rather than living inline in the http-request step) specifically
// so this security-critical logic can be unit-tested in isolation — see test/ssrf-guard.test.mjs.

export const CLOUD_METADATA_IP = "169.254.169.254";

export function ipToLong(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

export function inRange(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = parseInt(bitsStr, 10);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
}

export const BLOCKED_V4_RANGES = [
  "10.0.0.0/8", // RFC1918
  "172.16.0.0/12", // RFC1918
  "192.168.0.0/16", // RFC1918
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local (also covers the cloud metadata address)
  "0.0.0.0/8",
  "100.64.0.0/10", // carrier-grade NAT
];

export function isBlockedIPv4(ip: string): boolean {
  if (ip === CLOUD_METADATA_IP) return true;
  return BLOCKED_V4_RANGES.some((cidr) => inRange(ip, cidr));
}

export function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" || // loopback
    lower.startsWith("fe80:") || // link-local
    lower.startsWith("fc") || // unique local
    lower.startsWith("fd") ||
    lower === "::" ||
    lower.startsWith("::ffff:127.") // IPv4-mapped loopback
  );
}

/**
 * Validates a URL is safe to fetch: http/https only, and — if it's a literal IP or resolves
 * via DNS — not a private/internal/link-local/metadata address. Checks every address a
 * hostname resolves to (not just the first), so a DNS record can't be used to bypass the
 * block via rebinding. Throws with a human-readable message on any violation.
 */
export async function assertSafeTarget(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Blocked protocol: ${url.protocol}`);
  }

  const hostname = url.hostname;
  const version = isIP(hostname);
  if (version === 4 && isBlockedIPv4(hostname)) {
    throw new Error("Blocked target: request resolves to a private/internal IP range");
  }
  if (version === 6 && isBlockedIPv6(hostname)) {
    throw new Error("Blocked target: request resolves to a private/internal IP range");
  }
  if (version === 0) {
    // Hostname, not a literal IP — resolve it and check every returned address.
    const records = await lookup(hostname, { all: true });
    for (const rec of records) {
      if (rec.family === 4 && isBlockedIPv4(rec.address)) {
        throw new Error("Blocked target: hostname resolves to a private/internal IP range");
      }
      if (rec.family === 6 && isBlockedIPv6(rec.address)) {
        throw new Error("Blocked target: hostname resolves to a private/internal IP range");
      }
    }
  }
  return url;
}
