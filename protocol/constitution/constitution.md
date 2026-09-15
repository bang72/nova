# NOVA Protocol Constitution v1 Draft

The canonical NOVA network preserves five constitutional invariants:

1. **Genesis identity** — canonical state must descend from the published NOVA genesis root.
2. **Valid state continuity** — every state is produced by a valid transition or an explicitly authorized migration.
3. **Ownership authorization** — assets move only under the active authorization policy of the owning account.
4. **Maximum supply** — aggregate NOVA issuance can never exceed 250,000,000 NOVA.
5. **Monetary boundary** — NOVA can be issued only by the deterministic emission specification; ordinary governance has no arbitrary mint capability.

Consensus algorithm, VM, storage engine, network transport, signature suite and client implementation are not constitutional and may migrate without resetting ownership.
