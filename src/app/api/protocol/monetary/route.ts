import { NextResponse } from "next/server";
import { GENESIS_ALLOCATION, MAX_SUPPLY, emissionByYear } from "@/lib/protocol/monetary";
export function GET(){return NextResponse.json({ticker:"NOVA",status:"research",mainnet:false,maxSupply:MAX_SUPPLY.toString(),genesisAllocation:GENESIS_ALLOCATION.toString(),scheduledEmissionYears:1000,checkpoints:[1,10,50,100,250,500,750,1000].map(year=>({year,emission:emissionByYear(year).toString()}))});}
