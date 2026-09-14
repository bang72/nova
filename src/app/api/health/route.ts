import { NextResponse } from "next/server";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json({ok:true,service:"nova",protocol:"research",mainnet:false,time:new Date().toISOString()});}
