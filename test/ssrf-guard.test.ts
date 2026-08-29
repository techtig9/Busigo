import { test } from "node:test";
import assert from "node:assert/strict";
import { isBlockedIPv4, isBlockedIPv6, inRange, ipToLong, assertSafeTarget } from "../lib/engine/ssrf-guard";

test("ipToLong: converts a dotted IPv4 address to its 32-bit integer form", () => {
  assert.equal(ipToLong("0.0.0.1"), 1);
  assert.equal(ipToLong("255.255.255.255"), 4294967295);
});

test("inRange: correctly matches a /8, /16, and /32 CIDR", () => {
  assert.equal(inRange("10.5.5.5", "10.0.0.0/8"), true);
  assert.equal(inRange("11.5.5.5", "10.0.0.0/8"), false);
  assert.equal(inRange("192.168.50.1", "192.168.0.0/16"), true);
  assert.equal(inRange("192.169.50.1", "192.168.0.0/16"), false);
  assert.equal(inRange("1.2.3.4", "1.2.3.4/32"), true);
  assert.equal(inRange("1.2.3.5", "1.2.3.4/32"), false);
});

test("isBlockedIPv4: blocks every RFC1918 private range", () => {
  for (const ip of ["10.0.0.1", "10.255.255.254", "172.16.0.1", "172.31.255.254", "192.168.0.1", "192.168.255.254"]) {
    assert.equal(isBlockedIPv4(ip), true, `expected ${ip} to be blocked`);
  }
});

test("isBlockedIPv4: blocks loopback, link-local, and the cloud metadata address", () => {
  assert.equal(isBlockedIPv4("127.0.0.1"), true);
  assert.equal(isBlockedIPv4("169.254.169.254"), true);
  assert.equal(isBlockedIPv4("169.254.1.1"), true);
});

test("isBlockedIPv4: blocks carrier-grade NAT range (100.64.0.0/10)", () => {
  assert.equal(isBlockedIPv4("100.64.0.1"), true);
  assert.equal(isBlockedIPv4("100.127.255.254"), true);
  assert.equal(isBlockedIPv4("100.128.0.1"), false);
});

test("isBlockedIPv4: allows genuine public IPs", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.15.0.1", "172.32.0.1"]) {
    assert.equal(isBlockedIPv4(ip), false, `expected ${ip} to be allowed`);
  }
});

test("isBlockedIPv6: blocks loopback, link-local, and unique-local ranges", () => {
  assert.equal(isBlockedIPv6("::1"), true);
  assert.equal(isBlockedIPv6("fe80::1"), true);
  assert.equal(isBlockedIPv6("fc00::1"), true);
  assert.equal(isBlockedIPv6("fd12:3456::1"), true);
  assert.equal(isBlockedIPv6("::ffff:127.0.0.1"), true);
});

test("isBlockedIPv6: allows a genuine public IPv6 address", () => {
  assert.equal(isBlockedIPv6("2001:4860:4860::8888"), false);
});

test("assertSafeTarget: rejects non-http(s) protocols", async () => {
  await assert.rejects(() => assertSafeTarget("ftp://example.com/file"), /Blocked protocol/);
  await assert.rejects(() => assertSafeTarget("file:///etc/passwd"), /Blocked protocol/);
});

test("assertSafeTarget: rejects a literal private/internal IP target outright, no DNS needed", async () => {
  await assert.rejects(() => assertSafeTarget("http://127.0.0.1/admin"), /private\/internal IP/);
  await assert.rejects(() => assertSafeTarget("http://169.254.169.254/latest/meta-data/"), /private\/internal IP/);
  await assert.rejects(() => assertSafeTarget("http://10.0.0.5:8080/"), /private\/internal IP/);
});

test("assertSafeTarget: rejects a malformed URL", async () => {
  await assert.rejects(() => assertSafeTarget("not a url"), /Invalid URL/);
});

test("assertSafeTarget: allows a literal public IP target (no DNS lookup needed for this case)", async () => {
  const url = await assertSafeTarget("https://8.8.8.8/");
  assert.equal(url.hostname, "8.8.8.8");
});
