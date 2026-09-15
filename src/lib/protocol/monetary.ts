export const NOVA = {
  maxSupply: 250_000_000n,
  genesisCeiling: 10_000_000n,
  emissionPool: 240_000_000n,
  emissionYears: 1000n,
  decimals: 18,
} as const;

/**
 * Deterministic reference schedule for research/testnet.
 * Mainnet constants require formal specification + independent review.
 * Uses a normalized linear taper so issuance remains meaningful across generations
 * while the sum is exactly bounded by emissionPool.
 */
export function cumulativeEmission(year: bigint): bigint {
  if (year <= 0n) return 0n;
  if (year >= NOVA.emissionYears) return NOVA.emissionPool;
  // Weight falls from 1000 to 1 across 1000 annual epochs; integer-only.
  const n = NOVA.emissionYears;
  const y = year;
  const totalWeight = n * (n + 1n) / 2n;
  const elapsedWeight = y * (2n * n - y + 1n) / 2n;
  return NOVA.emissionPool * elapsedWeight / totalWeight;
}

export function canonicalSupplyCeiling(year: bigint): bigint {
  return NOVA.genesisCeiling + cumulativeEmission(year);
}
