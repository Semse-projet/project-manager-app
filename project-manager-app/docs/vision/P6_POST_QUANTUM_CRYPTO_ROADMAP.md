# P6 — Post-Quantum Cryptography (PQC) Roadmap

## Status: Architecture Only — Not Yet Implemented

SEMSE is **PQC-ready** at the protocol level. The current signing infrastructure is intentionally
abstracted so that migrating to post-quantum algorithms requires changing one function, not the
entire trust ecosystem.

---

## Current State (HMAC-SHA256)

All signed documents in SEMSE use the two-part token format:

```
base64url(JSON payload).base64url(HMAC-SHA256(key, payload))
```

The `cryptoProfile` field in `TrustPassportClaims` declares the algorithm used to sign each token.
The verify endpoint returns `X-Semse-Crypto-Profile` so clients can detect upgrades automatically.

Current profile: `HMAC-SHA256`

---

## Target: ML-DSA-65 (NIST FIPS 204)

When PQC migration is warranted:

1. **Algorithm**: ML-DSA-65 (formerly Dilithium3) — NIST-standardized lattice-based signature scheme.
   Security level: NIST Level 3 (128-bit quantum security).

2. **Library**: `@noble/post-quantum` (pure JS, audited, no native deps) or `liboqs` via WASM.

3. **Token format change**:
   ```
   base64url(JSON payload).base64url(ML-DSA-65-signature)
   ```
   `cryptoProfile: "ML-DSA-65"` in payload.

4. **Key management**:
   - Replace `PASSPORT_SECRET` / `AUTH_SECRET` (symmetric) with ML-DSA key pair.
   - Store private key in Railway secrets (or HSM for production hardening).
   - Public key published at `GET /v1/.well-known/semse-pqc-key`.

5. **Verification without DB**: Same as today — public key + signature + payload.
   No blockchain required.

---

## Migration Path (Zero-Downtime)

```
Phase A — Dual-sign (6 months):
  - New passports: signed with both HMAC-SHA256 AND ML-DSA-65
  - Verifiers: accept both
  - cryptoProfile: "ML-DSA-65" (primary)

Phase B — Drop HMAC (after all tokens expire ~30d):
  - Remove HMAC signing
  - Verifiers: ML-DSA-65 only
  - All existing issued passports expire naturally (30-day validity)

Phase C — Revocation list (optional hardening):
  - Publish revoked JTIs at /v1/.well-known/semse-revoked
```

---

## zk-SNARK Consideration (Long Term)

zk-SNARKs (e.g., Groth16, PLONK) would allow **zero-knowledge verification** of reputation:
"Prove score ≥ 50 without revealing the exact score."

Use case: Privacy-preserving governance voting — voter proves they meet participation threshold
without revealing identity or exact reputation.

**Not blocking anything today.** The `cryptoProfile` field is the integration point.
Add a new profile value `"zkSNARK-Groth16"` when this is implemented.

---

## What Is Already Done (P6 foundation)

- `CryptoProfile` type in `trust-passport.types.ts` with `HMAC-SHA256 | Dilithium3 | ML-DSA-65`
- `cryptoProfile` field embedded in every Trust Passport payload
- `X-Semse-Crypto-Profile` response header on verify endpoint
- This document

**Effort to complete P6**: ~2 days once `@noble/post-quantum` library is audited and Node.js
v22+ Web Crypto PQC extensions land (tentatively 2026 H2).
