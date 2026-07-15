# Secrets, sanitisation, and deletion evidence

## OWASP lessons

Secrets should be centralised, least-privileged, rotated, short-lived/dynamic where possible, delivered without unnecessary persistence, and audited. Agent systems add prompt/tool/memory injection, excessive autonomy, exfiltration, replay, and denial-of-wallet risks.

## NIST lessons

Zero trust rejects implicit trust based on network location. Key-management guidance matters for envelope encryption and key destruction. Media-sanitisation guidance distinguishes ordinary deletion from stronger sanitisation and evidence requirements.

## Toolshape conclusion

“Detect a secret, encrypt it, and delete it after the response” is incomplete because:

- the model/provider may already have received plaintext;
- logs/traces/crashes/backups/clipboard can copy it;
- encryption does not remove access while keys remain;
- deletion calls can fail or leave snapshots;
- secret detectors miss values.

The defensible architecture is:

```text
avoid plaintext in model context
→ opaque handle
→ scoped short-lived lease
→ isolated executor
→ just-in-time resolution
→ redaction before persistence
→ revoke and destroy per-job key
→ delete owned temporary stores
→ report external retention boundaries
```

## Crypto-erasure

Destroying a unique encryption key can render remaining ciphertext inaccessible, but only if:

- strong encryption/key separation were used;
- no other key/plaintext copies exist;
- the key is actually destroyed across backups/replicas;
- endpoint memory and remote processors are separately handled.

Never phrase crypto-erasure as universal deletion.
