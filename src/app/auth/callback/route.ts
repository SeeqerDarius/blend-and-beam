import {NextResponse} from "next/server";import {createClient} from "@/lib/supabase/server";import {safeAuthNext} from "@/lib/auth-validation";
export async function GET(request:Request){const url=new URL(request.url);const code=url.searchParams.get("code");const origin=process.env.NEXT_PUBLIC_APP_URL||url.origin;
if(!code)return NextResponse.redirect(new URL("/login?error=Invalid or expired confirmation link. Request a new one.",origin));
const db=await createClient();const {error}=await db.auth.exchangeCodeForSession(code);
return NextResponse.redirect(new URL(error?"/login?error=Confirmation failed or the link expired. Request a new one.":safeAuthNext(url.searchParams.get("next")),origin));}
