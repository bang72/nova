# NOVA Protocol R1 - Normative Devnet Profile

## Identity

The chain domain is fixed by genesis. Account identifiers use the
`nova1<40 lowercase hexadecimal characters>` form. An Account ID is not a
public key. Authorization policy version 1 uses crypto suite `K-0001`
(Ed25519 over canonical UTF-8 JSON). Key rotation increments the policy version
without changing the Account ID or balance.

## Units and supply

One NOVA equals 1,000,000 atoms. Genesis creates exactly 10,000,000 NOVA:

| Bucket | NOVA |
| --- | ---: |
| Ecosystem and public goods | 4,000,000 |
| Validator/security bootstrap | 2,000,000 bonded |
| Core protocol foundation | 1,500,000 |
| Initial user distribution | 1,000,000 |
| Liquidity/market infrastructure | 1,000,000 |
| Audits/research bounties | 500,000 |

The committed integer schedule contains exactly 1,000 annual entries totaling
240,000,000 NOVA. Consensus interpolates within a year using integer division.
Total supply MUST NOT exceed 250,000,000 NOVA.

## Transaction envelope

Transactions contain `chainDomain`, `accountId`, `authPolicyVersion`,
`nonce`, one to eight actions, `feePolicy`, `expiry`, and an
`authorizationProof`. The transaction ID is the SHA-256 hash of canonical
encoding. R1 actions are `transfer`, `create_account`, and `rotate_key`.

## Block envelope

Headers commit to chain ID, parent, height, epoch, timestamp, state root,
transaction root, receipt root, data-availability payload, protocol tuple and
optional migration marker. A certificate signs the block hash and state root.
At least two thirds of active stake must sign.

## Version tuple

R1 is `C1/E1/K1/S1/N1`. Every decoder MUST reject unsupported semantics rather
than silently interpreting another version.

## R1 boundary

R1 is suitable for deterministic local/devnet operation and conformance work.
It is not authorized for a monetary mainnet before the white paper launch
gates are met.
