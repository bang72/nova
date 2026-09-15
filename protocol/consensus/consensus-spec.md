# NOVA Consensus v1 — Engineering Direction

NOVA v1 targets stake-weighted Byzantine fault tolerant consensus with deterministic finality. The reference RPC executable in this branch is **not** the production consensus engine; it serializes accepted transactions into blocks so state-transition code can be exercised before distributed consensus is frozen.

Production consensus must define and test:

- validator-set transition at epoch boundaries;
- weighted proposer selection;
- prevote/precommit or equivalent safety rounds;
- >2/3 voting-power finality certificate;
- equivocation evidence and slashing;
- bounded timeout progression;
- network-partition recovery;
- weak-subjectivity/checkpoint bootstrap for long-offline nodes;
- deterministic evidence serialization;
- two independent client implementations.
