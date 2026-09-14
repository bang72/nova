import { z } from "zod";
export const registerSchema=z.object({handle:z.string().min(3).max(32).regex(/^[a-z0-9_]+$/),displayName:z.string().min(1).max(80),password:z.string().min(10).max(200)});
export const loginSchema=z.object({handle:z.string().min(1).max(32),password:z.string().min(1).max(200)});
export const postSchema=z.object({body:z.string().trim().min(1).max(1000),parentId:z.string().optional()});
