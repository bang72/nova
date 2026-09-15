import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ATOMS_PER_NOVA = 1_000_000n;
export const GENESIS_SUPPLY = 10_000_000n * ATOMS_PER_NOVA;
export const EMISSION_POOL = 240_000_000n * ATOMS_PER_NOVA;
export const HARD_CAP = 250_000_000n * ATOMS_PER_NOVA;
const schedulePath = fileURLToPath(new URL("../spec/emission-schedule.json", import.meta.url));
export const ANNUAL_EMISSION = Object.freeze(JSON.parse(readFileSync(schedulePath, "utf8")).map(BigInt));

if (ANNUAL_EMISSION.length !== 1000) throw new Error("NOVA emission schedule must contain 1,000 years");
if (ANNUAL_EMISSION.reduce((a, b) => a + b, 0n) !== EMISSION_POOL) throw new Error("NOVA emission schedule violates the 240M pool");

export function cumulativeEmission(elapsedSeconds, secondsPerYear = 31_557_600n) {
  if (elapsedSeconds <= 0n) return 0n;
  const fullYears = elapsedSeconds / secondsPerYear;
  const remainder = elapsedSeconds % secondsPerYear;
  const boundedYears = fullYears > 1000n ? 1000n : fullYears;
  let total = 0n;
  for (let year = 0; year < Number(boundedYears); year++) total += ANNUAL_EMISSION[year];
  if (boundedYears < 1000n) total += (ANNUAL_EMISSION[Number(boundedYears)] * remainder) / secondsPerYear;
  return total > EMISSION_POOL ? EMISSION_POOL : total;
}

export function formatNova(atoms) {
  const value = BigInt(atoms), sign = value < 0n ? "-" : "", absolute = value < 0n ? -value : value;
  return `${sign}${absolute / ATOMS_PER_NOVA}.${(absolute % ATOMS_PER_NOVA).toString().padStart(6, "0")}`;
}

export function parseNova(value) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(text)) throw new Error("Amount must be positive with at most 6 decimals");
  const [whole, fraction = ""] = text.split(".");
  const atoms = BigInt(whole) * ATOMS_PER_NOVA + BigInt(fraction.padEnd(6, "0"));
  if (atoms <= 0n) throw new Error("Amount must be greater than zero");
  return atoms;
}
