# NOVA Staking v1 — Parameter Draft

The codebase carries explicit parameters rather than hiding economic constants in unrelated logic. Current values are **testnet defaults**, not constitutional rules:

- minimum validator self-bond: 25,000 NOVA;
- unbonding delay: 21 epochs;
- downtime penalty: 0.50%;
- provable equivocation penalty: 50%;
- validator commission ceiling: 20%.

These parameters require economic simulation before mainnet. Supply cap and ownership authorization are constitutional; staking percentages are not.
