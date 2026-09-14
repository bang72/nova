import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
export async function POST(req:Request){try{const input=registerSchema.parse(await req.json());const handle=input.handle.toLowerCase();if(await db.user.findUnique({where:{handle}}))return NextResponse.json({error:"Handle is already taken."},{status:409});const user=await db.user.create({data:{handle,displayName:input.displayName,passwordHash:await hash(input.password,12)}});await createSession(user.id);return NextResponse.json({user:{id:user.id,handle:user.handle,displayName:user.displayName}},{status:201});}catch{return NextResponse.json({error:"Invalid registration request."},{status:400});}}
