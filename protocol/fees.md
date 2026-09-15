# NOVA Fee Market v1 — Design Contract

NOVA separates social activity from scarce L1 execution. Posts, follows and ordinary replies are not L1 transactions.

L1 fees meter resources used by settlement, authorization changes, staking and application execution. The reference state machine collects accepted transaction fees into an explicit `fee_pool`, which is committed in the state root. This prevents fees from silently disappearing and preserves the supply-conservation invariant. Future epoch processing will deterministically distribute or burn fee portions according to the finalized monetary specification.

The mainnet fee market must separately account for compute, persistent state growth, bandwidth and data-availability pressure. Sponsored fees are permitted by account policy but never grant custody or bypass authorization.
