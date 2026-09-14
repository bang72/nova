import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { postSchema } from "@/lib/validation";
export async function GET(){const posts=await db.post.findMany({where:{parentId:null,visibility:"PUBLIC"},take:40,orderBy:{createdAt:"desc"},include:{author:{select:{handle:true,displayName:true}},_count:{select:{replies:true,reactions:true}}}});return NextResponse.json({posts});}
export async function POST(req:Request){const user=await currentUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});try{const input=postSchema.parse(await req.json());const post=await db.post.create({data:{authorId:user.id,body:input.body,parentId:input.parentId}});return NextResponse.json({post},{status:201});}catch{return NextResponse.json({error:"Invalid post."},{status:400});}}
