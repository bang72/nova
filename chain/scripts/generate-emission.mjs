import { mkdirSync, writeFileSync } from "node:fs";

const pool = 240_000_000n * 1_000_000n;
const weights = [];
for (let year = 0; year < 1000; year++) {
  const mid = year + 0.5;
  const taper = mid < 950 ? 1 : (() => { const x = (mid - 950) / 50; return 1 - (3 * x * x - 2 * x * x * x); })();
  weights.push(Math.pow(2, -mid / 500) * Math.max(0, taper));
}
const sum = weights.reduce((a, b) => a + b, 0);
const exact = weights.map((weight) => Number(pool) * weight / sum);
const schedule = exact.map((value) => BigInt(Math.floor(value)));
let remaining = pool - schedule.reduce((a, b) => a + b, 0n);
const order = exact.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
for (let i = 0; i < Number(remaining); i++) schedule[order[i].index] += 1n;
mkdirSync(new URL("../spec/", import.meta.url), { recursive: true });
writeFileSync(new URL("../spec/emission-schedule.json", import.meta.url), JSON.stringify(schedule.map(String), null, 2) + "\n");
