# NOVA L1 Mainnet Candidate R4

NOVA L1 R4 is a runnable, independent mainnet candidate derived from the
NOVA Millennium Social Protocol white paper. It is not an ERC-20 contract and
does not depend on another chain.

Implemented:

- deterministic account state and canonical transaction encoding;
- stable Account ID separated from rotatable Ed25519 authorization keys;
- signed transfer and key-rotation transactions;
- nonce, expiry, replay-domain, fee and hard-cap enforcement;
- persistent blocks, receipts and atomic state snapshots;
- deterministic Merkle commitments for state, transactions and receipts;
- validator-signed block certificates and stake-weight threshold verification;
- replicated multi-validator execution with independently persisted ledger state;
- duplicate-vote resistance and rejection of certificates below two-thirds stake;
- deterministic certified-block import with full commitment re-execution;
- four-process validator network with deterministic proposer rotation;
- signed proposal voting, persistent double-sign protection and transaction broadcast;
- native 256-bit Bech32m Account IDs with typo-resistant checksums;
- separate non-spendable prefixes for validators, transactions and blocks;
- versioned protocol tuple (consensus/execution/crypto/storage/network);
- fixed integer 1,000-year emission schedule totaling exactly 240,000,000 NOVA;
- exact 10,000,000 NOVA genesis allocation buckets;
- HTTP JSON RPC and command-line wallet.

## Run

```bash
pnpm nova:init
pnpm nova:start
```

In another terminal:

```bash
pnpm nova:status
pnpm nova:balance -- --account <NOVA_ACCOUNT_ID>
pnpm nova:transfer -- --key .nova/keys/ecosystem.json --to <NOVA_ACCOUNT_ID> --amount 12.5
```

The default RPC is `http://127.0.0.1:4178`. Set `NOVA_DATA_DIR` or
`NOVA_RPC_URL` to use another location.

## Four-validator network

```bash
cd chain
npm run network:init
npm run network:start
```

The four local validator RPC endpoints are `4181` through `4184`. Submit a
signed transfer to any validator and it is broadcast before the next proposer
round:

```bash
NOVA_RPC_URL=http://127.0.0.1:4181 node src/cli.mjs transfer \
  --key .nova-network/client-keys/ecosystem.json \
  --to <NOVA_ACCOUNT_ID> --amount 12.5
```

## Native ecosystem identifiers

- `nova1...` — mainnet payment account;
- `tnova1...` — testnet payment account;
- `novaval1...` — validator display identity, never a payment destination;
- `novatx1...` — transaction display identity;
- `novablk1...` — block display identity.

Account IDs remain stable during authorization-key rotation. Wallets reject
mixed case, corrupted checksums, invalid padding, wrong lengths and unsupported
address versions.

## Container

```bash
cd chain
docker compose run --rm nova-node init
docker compose up --build
```

For the four-validator topology, initialize `.nova-network` first and run
`docker compose -f network-compose.yaml up --build`. Ports `4181` through
`4184` expose the independent nodes.

## Security boundary

R4 contains a real multi-process validator network, replicated state machine,
quorum verification and persisted double-sign protection. Consensus messages
are cryptographically signed, but transport is currently allowlisted HTTP and
does not yet provide production mTLS or denial-of-service protection. The
reference implementation is also still a single client. Mainnet activation
therefore remains locked behind hardened transport, an independent second
client, an adversarial public testnet, formal checks, external audits and a
public genesis ceremony as required by the white paper.
