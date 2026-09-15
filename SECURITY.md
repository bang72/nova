# NOVA Security Policy

NOVA is pre-mainnet research software. Do not use it to custody real economic value.

## Mandatory security properties

- hard cap: 250,000,000 NOVA;
- no protocol path may transfer ownership without account authorization;
- account identity is separate from cryptographic key material;
- every signature is domain-separated by chain and transaction format;
- key rotation increments authorization-policy version without changing Account ID;
- consensus, execution and cryptographic suites are versioned and replaceable;
- founder/bootstrap authority must have a published sunset before genesis.

## Disclosure

Do not publish an exploitable vulnerability before maintainers have had a reasonable opportunity to patch affected test networks. Mainnet security contacts and bounty terms must be defined before genesis.
