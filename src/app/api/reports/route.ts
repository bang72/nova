import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
const schema=z.object({targetType:z.enum(["post","user","message"]),targetId:z.string().min(1),reason:z.string().trim().min(3).max(500)});
export async function POST(req:Request){const user=await currentUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});try{const input=schema.parse(await req.json());const report=await db.report.create({data:{reporterId:user.id,...input}});return NextResponse.json({report},{status:201});}catch{return NextResponse.json({error:"Invalid report."},{status:400});}}
