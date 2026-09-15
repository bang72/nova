# NOVA Account Model v1

An Account ID is stable state identity; it is not the public key itself. Authorization Policy contains a versioned cryptographic suite and key material. A key rotation modifies authorization while preserving account identity, balances and social bindings.

V1 transaction authorization domains include chain ID, sender, nonce, fee, expiry and action payload. Future suites may add threshold, passkey, hardware, hybrid and post-quantum policies without changing Account ID.
