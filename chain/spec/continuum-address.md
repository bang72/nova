# NOVA Continuum Address (NCA-1)

Status: experimental NOVA-native mainnet-candidate specification.

NCA is not Bech32, Bech32m, Base58Check or an Ethereum hexadecimal address.
It defines a NOVA-specific binary identity envelope and a separate human text
rendering. It does not invent a new signature or hash primitive.

## Longevity model

No engineering design can guarantee survival for 1,000 years. NCA instead
removes the most likely sources of permanent lock-in:

1. The ledger key is a random 256-bit Account ID, independent of public keys.
2. Authorization policies and signature suites can rotate without moving funds.
3. The printed address is not the ledger key and can be replaced by NCA-2 or a
   future binary/optical representation while preserving the Account ID.
4. Network, object type, format version, checksum suite and NOVA Realm ID are
   explicit rather than inferred.
5. The initial integrity function has an identifier and can be deprecated.

This follows the crypto-agility principle of carrying algorithm identifiers and
supporting coordinated replacement. Post-quantum authentication belongs in the
account authorization policy, not in the permanent address.

## Permanent realm

The NOVA Millennium realm identifier committed by R5 is:

`ec7601ee487ab2bd2d076e41009ca780`

It identifies this ecosystem across protocol upgrades. A decoder rejects an
otherwise valid envelope carrying a foreign realm.

## Binary envelope

| Offset | Bytes | Meaning |
| ---: | ---: | --- |
| 0 | 1 | NCA format version (`1`) |
| 1 | 1 | network: mainnet `0`, testnet `1`, private `2` |
| 2 | 1 | object: account `1`, validator `2`, transaction `3`, block `4` |
| 3 | 1 | checksum suite (`1` = SHA-512/256 domain-separated tag) |
| 4 | 16 | permanent NOVA Realm ID |
| 20 | 32 | stable object identifier |
| 52 | 16 | integrity tag over bytes 0–51 |

The integrity tag is the first 128 bits of:

`SHA-512/256("NOVA:NCA:CHECKSUM:1\\0" || core)`

The checksum is for corruption detection and domain separation, not ownership.
Ownership is proven by the versioned authorization policy stored on-chain.

## NOVA32 text rendering

NCA uses the NOVA32 alphabet:

`0123456789abcdefghjkmnpqrstvwxyz`

The letters `i`, `l`, `o`, and `u` are excluded to reduce visual ambiguity and
accidental word formation. Canonical output is lowercase and grouped in blocks
of eight characters.

| Object | Header |
| --- | --- |
| Mainnet account | `nva-m-a1-` |
| Testnet account | `nva-t-a1-` |
| Private-network account | `nva-p-a1-` |
| Mainnet validator | `nva-m-v1-` |
| Mainnet transaction | `nva-m-x1-` |
| Mainnet block | `nva-m-b1-` |

Only object type `account` is spendable. Wallets must never silently normalize,
truncate or auto-correct input. They may show possible one-symbol repairs, but
the user must explicitly choose the canonical address.

## Migration rule

When NCA-1 primitives become unsuitable, governance registers a new format and
dual-renders the same 256-bit internal Account ID. No balance migration or key
reuse is required. Old decoders fail closed on unknown versions or suites.

## Research basis

- BIP-350 documents useful checksum and transcription-error lessons from
  Bech32m; NCA uses a different envelope, alphabet and 128-bit tag.
- NIST CSWP 39 recommends mechanisms that identify and replace cryptographic
  algorithms while maintaining interoperability.
- NIST FIPS 204 and 205 provide standardized post-quantum signature families;
  NCA keeps addresses independent so these or future suites can be adopted.
- RFC 8949 deterministic-encoding work supports the broader rule that consensus
  objects require one unambiguous binary representation.
