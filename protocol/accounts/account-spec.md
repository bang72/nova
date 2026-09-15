# NOVA Account Model v1

An Account ID is stable state identity and is **not derived from a signature public key**. At creation, 256 bits of account entropy are domain-separated and hashed into the Account ID. Authorization Policy separately contains a versioned cryptographic suite and key material.

A key rotation modifies authorization while preserving Account ID, balances and explicit social bindings. Transactions commit to the active `auth_policy_version`; stale-policy transactions are rejected even if their nonce otherwise appears valid.

V1 authorization supports Ed25519 as the first active suite. The suite registry is deliberately versioned so threshold, passkey/hardware-backed, hybrid and post-quantum policies can be activated without changing Account ID.
