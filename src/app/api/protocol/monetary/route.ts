import { NextResponse } from "next/server";
import { NOVA, cumulativeEmission, canonicalSupplyCeiling } from "@/lib/protocol/monetary";

export function GET(){
  const checkpoints=[1,10,50,100,250,500,750,1000].map(year=>({
    year,
    emitted:cumulativeEmission(BigInt(year)).toString(),
    supplyCeiling:canonicalSupplyCeiling(BigInt(year)).toString()
  }));
  return NextResponse.json({
    ticker:"NOVA",
    status:"research",
    mainnet:false,
    maxSupply:NOVA.maxSupply.toString(),
    genesisCeiling:NOVA.genesisCeiling.toString(),
    emissionPool:NOVA.emissionPool.toString(),
    scheduledEmissionYears:Number(NOVA.emissionYears),
    decimals:NOVA.decimals,
    checkpoints
  });
}
