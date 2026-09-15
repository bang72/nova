# NOVA Monetary Specification — Draft for Audit

- Decimal precision: 8.
- Maximum supply: 250,000,000 NOVA.
- Proposed genesis allocation ceiling: 10,000,000 NOVA.
- Proposed protocol emission pool: 240,000,000 NOVA over a 1,000-year horizon.
- Ordinary governance cannot increase the hard cap.

## Critical implementation rule

Consensus code MUST use integer/fixed-point arithmetic or committed cumulative issuance vectors. Floating-point arithmetic is forbidden in consensus.

The reference crate currently exposes only the constitutional cap guard and a clearly marked devnet emission function. The final Millennium Emission Curve is intentionally blocked from mainnet until the fixed-point algorithm and 0–1000 year vectors have been independently reproduced.
