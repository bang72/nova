# NOVA — Millennium Continuity Protocol

NOVA is a sovereign continuity network designed to preserve **ownership, state continuity and monetary law** while allowing consensus, cryptography, execution, networking, storage and clients to evolve over generations.

> Preserve the ledger. Preserve ownership. Preserve monetary law. Replace everything else.

## Repository status

This branch is the **mature engineering baseline**, not a claim of audited mainnet readiness. It contains an executable reference ledger, cryptographic authorization, deterministic state root, hard-cap guard, RPC node, CLI, normative protocol documents and CI gates. Real-value mainnet remains blocked on independent client interoperability, audited consensus, finalized MEC arithmetic, adversarial testnets and external security review.

## Quick start

```bash
cargo test --workspace
cargo run -p nova-node
# another terminal
cargo run -p nova-cli -- keygen --out alice.key
curl http://127.0.0.1:7711/v1/status
```

## Architectural boundaries

- **L1:** ownership, balances, authorization, staking, protocol commitments and settlement.
- **Social protocol:** signed portable repositories; social activity is not forced onto L1.
- **Wallet:** economic actions only; social UX can remain crypto-light.
- **Explorer:** public inspection of canonical ledger state.
- **Archive:** protocol continuity artifacts and historical preservation.

## Mainnet launch gates

No release may be called mainnet-ready until all of the following are true:

1. normative state-transition and monetary specifications are frozen for genesis;
2. two independent clients pass the same conformance vectors;
3. consensus and authorization code receive external audits;
4. supply and migration invariants are formally checked where feasible;
5. long-running adversarial testnet and recovery drills pass;
6. genesis allocation, vesting, ceremony transcript and bootstrap-key sunset are public.

See `protocol/` and `SECURITY.md`.
