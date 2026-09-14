import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
export async function POST(req:Request){try{const input=loginSchema.parse(await req.json());const user=await db.user.findUnique({where:{handle:input.handle.toLowerCase()}});if(!user||!(await compare(input.password,user.passwordHash)))return NextResponse.json({error:"Invalid handle or password."},{status:401});await createSession(user.id);return NextResponse.json({user:{id:user.id,handle:user.handle,displayName:user.displayName}});}catch{return NextResponse.json({error:"Invalid login request."},{status:400});}}
