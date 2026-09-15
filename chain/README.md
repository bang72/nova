# NOVA L1 R1

NOVA L1 R1 is a runnable, independent blockchain devnet derived from the
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

## Container

```bash
cd chain
docker compose run --rm nova-node init
docker compose up --build
```

The compose service stores chain state in the `nova-data` volume and exposes
RPC port `4178`.

## Security boundary

R1 is a real single-validator devnet implementation, not a mainnet candidate.
Mainnet still requires independent second-client interoperability, adversarial
testnet, formal checks, external audits, validator networking and a public
genesis ceremony as required by the white paper.
