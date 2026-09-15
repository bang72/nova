# NOVA Native Identifier Format

NOVA uses Bech32m checksummed identifiers and does not use hexadecimal wallet
addresses as its canonical account format.

| Object | Mainnet prefix | Testnet prefix | Spendable |
| --- | --- | --- | --- |
| Account | `nova1` | `tnova1` | Yes |
| Validator display ID | `novaval1` | `tnovaval1` | No |
| Transaction display ID | `novatx1` | `novatx1` | No |
| Block display ID | `novablk1` | `novablk1` | No |

An account payload contains address-format version `1` followed by a random
256-bit stable identifier. It is deliberately independent from the active
authorization public key, allowing Ed25519 keys and future cryptographic suites
to rotate without changing the receiving address or balance.

Decoders MUST reject mixed case, an invalid checksum, non-zero padding,
unsupported versions, unsupported prefixes and payloads not exactly 256 bits.
Wallets MUST only permit transfers to `nova1` or `tnova1`; validator,
transaction and block identifiers are display-only.

The transaction `chainDomain`, rather than the address alone, prevents replay
between distinct NOVA chains. Mainnet uses chain ID `nova-mainnet-1`.
