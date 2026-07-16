import test from "node:test";
import assert from "node:assert/strict";
import { SecureNetworkGateway } from "../../packages/autonomy/dist/browser/secure-network-gateway.js";
import { SessionManager } from "../../packages/autonomy/dist/browser/session-manager.js";

test("browser-governance: isIpSafe allows safe public IPs", () => {
  assert.equal(SecureNetworkGateway.isIpSafe("8.8.8.8"), true);
  assert.equal(SecureNetworkGateway.isIpSafe("1.1.1.1"), true);
});

test("browser-governance: isIpSafe blocks private/loopback IPs", () => {
  // Loopback
  assert.equal(SecureNetworkGateway.isIpSafe("127.0.0.1"), false);
  assert.equal(SecureNetworkGateway.isIpSafe("127.255.255.255"), false);
  
  // Private Class A
  assert.equal(SecureNetworkGateway.isIpSafe("10.0.0.1"), false);
  
  // Private Class B
  assert.equal(SecureNetworkGateway.isIpSafe("172.16.0.1"), false);
  assert.equal(SecureNetworkGateway.isIpSafe("172.31.255.255"), false);
  
  // Private Class C
  assert.equal(SecureNetworkGateway.isIpSafe("192.168.1.1"), false);
  
  // Link-Local
  assert.equal(SecureNetworkGateway.isIpSafe("169.254.1.1"), false);

  // Shared address space
  assert.equal(SecureNetworkGateway.isIpSafe("100.64.0.1"), false);
});

test("browser-governance: isUrlSafe accepts safe domains and rejects unsafe ones", async () => {
  assert.equal(await SecureNetworkGateway.isUrlSafe("https://google.com"), true);
  assert.equal(await SecureNetworkGateway.isUrlSafe("http://localhost"), false);
  assert.equal(await SecureNetworkGateway.isUrlSafe("ftp://google.com"), false);
});

test("browser-governance: SessionManager encrypts and decrypts cookies", () => {
  const plainCookies = "session=xyz123; user=yoni";
  const keyHex = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"; // 32 bytes

  const { encrypted, iv, tag } = SessionManager.encryptCookies(plainCookies, keyHex);
  assert.ok(encrypted);
  assert.ok(iv);
  assert.ok(tag);

  const decrypted = SessionManager.decryptCookies(encrypted, iv, tag, keyHex);
  assert.equal(decrypted, plainCookies);
});
export {};
