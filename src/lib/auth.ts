import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
const COOKIE="nova_session";
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
export async function createSession(userId:string){const raw=randomBytes(32).toString("base64url");const expiresAt=new Date(Date.now()+1000*60*60*24*30);await db.session.create({data:{userId,tokenHash:hash(raw),expiresAt}});(await cookies()).set(COOKIE,raw,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",expires:expiresAt});}
export async function destroySession(){const jar=await cookies();const raw=jar.get(COOKIE)?.value;if(raw)await db.session.deleteMany({where:{tokenHash:hash(raw)}});jar.delete(COOKIE);}
export async function currentUser(){const raw=(await cookies()).get(COOKIE)?.value;if(!raw)return null;const session=await db.session.findUnique({where:{tokenHash:hash(raw)},include:{user:true}});if(!session||session.expiresAt<=new Date())return null;return{id:session.user.id,handle:session.user.handle,displayName:session.user.displayName,role:session.user.role};}
