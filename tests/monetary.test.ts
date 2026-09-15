import test from "node:test";
import assert from "node:assert/strict";
import { canonicalSupplyCeiling, cumulativeEmission, NOVA } from "../src/lib/protocol/monetary";

test("issuance starts at zero and ends at the exact pool cap",()=>{
 assert.equal(cumulativeEmission(0n),0n);
 assert.equal(cumulativeEmission(1000n),NOVA.emissionPool);
 assert.equal(canonicalSupplyCeiling(1000n),NOVA.maxSupply);
});

test("issuance is monotonic and never breaches the constitution",()=>{
 let last=0n;
 for(let y=0n;y<=1000n;y++){
   const issued=cumulativeEmission(y);
   assert.ok(issued>=last);
   assert.ok(canonicalSupplyCeiling(y)<=NOVA.maxSupply);
   last=issued;
 }
});
