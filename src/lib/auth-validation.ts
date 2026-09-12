import {z} from "zod";
export const credentials=z.object({email:z.string().trim().email().max(254),password:z.string().min(1).max(128)});
export const signupCredentials=credentials.extend({password:z.string().min(12).max(128)});
export function safeNext(value:unknown){return typeof value==="string"&&/^\/(account|admin)(\/[a-zA-Z0-9/_-]*)?$/.test(value)?value:"/account";}
