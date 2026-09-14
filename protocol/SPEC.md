# NOVA Protocol — Generation 0

Status: **research / pre-testnet**. This specification intentionally does not claim a live cryptocurrency or production mainnet.

## Constitutional invariants

1. Canonical NOVA supply MUST NOT exceed 250,000,000 NOVA.
2. State transitions MUST preserve valid ownership authorization.
3. Every protocol generation MUST prove continuity from the previous canonical state.
4. Social ranking, popularity, identity-provider decisions and application rewards MUST NOT define ledger consensus.
5. A network that intentionally violates a constitutional invariant is a distinct protocol identity, even if participants choose to fork the software.

## Replaceable machinery

Consensus, signature suites, execution engines, networking transports, proof systems, data availability and storage implementations are versioned machinery rather than constitutional identity.

## Monetary research constants

- Maximum canonical supply: 250,000,000 NOVA
- Genesis allocation ceiling: 10,000,000 NOVA
- Post-genesis issuance pool: 240,000,000 NOVA
- Research issuance horizon: 1,000 annual epochs
- Monetary calculations: deterministic integer arithmetic only

The current TypeScript monetary module is a reference implementation for product simulation and testnet research. It is not a mainnet monetary specification until formal review and an explicit genesis process.

## Mainnet gates

No mainnet genesis before: a formal state-transition specification; at least two independently maintained validating clients; deterministic cross-client vectors; external cryptography and protocol audits; adversarial public testnets; reproducible genesis artifacts; published validator and recovery procedures; economic simulations; and jurisdiction-specific launch review.
