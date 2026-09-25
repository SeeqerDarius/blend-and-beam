import {z} from "zod";
export const credentials=z.object({email:z.string().trim().toLowerCase().email().max(254),password:z.string().min(1).max(128)});
export const signupCredentials=credentials.extend({password:z.string().min(12).max(128)});
export function safeNext(value:unknown){return typeof value==="string"&&/^\/(account|admin)(\/[a-zA-Z0-9/_-]*)?$/.test(value)?value:"/account";}
export function safeAuthNext(value:unknown){return value==="/account/setup-password"||value==="/account/security"?value:"/account";}

export function signInErrorMessage(error:{code?:string;status?:number}){
 if(error.code==="email_not_confirmed")return "Confirm your email from the link we sent, then sign in. If the link expired, create a new account request or contact support.";
 if(error.status===429)return "Too many sign-in attempts. Wait a few minutes and try again.";
 if(error.code==="invalid_credentials"||error.code==="user_not_found")return "Email or password did not match. Check your details or reset your password.";
 return "Sign-in is temporarily unavailable. Please try again shortly.";
}
