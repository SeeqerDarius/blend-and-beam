import {NextResponse} from "next/server";import {createClient} from "@/lib/supabase/server";
export async function GET(request:Request){const code=new URL(request.url).searchParams.get("code");const origin=process.env.NEXT_PUBLIC_APP_URL!;
if(!code)return NextResponse.redirect(new URL("/login?error=Invalid confirmation link",origin));
const db=await createClient();const {error}=await db.auth.exchangeCodeForSession(code);
return NextResponse.redirect(new URL(error?"/login?error=Confirmation failed. Request a new link.":"/account",origin));}
