"use server";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {credentials,signupCredentials,safeNext} from "@/lib/auth-validation";
export async function signIn(form:FormData){
 const values=credentials.safeParse({email:form.get("email"),password:form.get("password")});
 if(!values.success)redirect("/login?error=Enter a valid email and password");
 const db=await createClient();const {error}=await db.auth.signInWithPassword(values.data);
 if(error)redirect("/login?error=Unable to sign in. Check your credentials or try again later.");
 const {data:member}=await db.rpc("staff_membership");redirect(member===true?"/admin":safeNext(form.get("next")));
}
export async function signUp(form:FormData){
 const values=signupCredentials.safeParse({email:form.get("email"),password:form.get("password")});
 if(!values.success)redirect("/login?error=Use a valid email and a password of at least 12 characters.");
 const db=await createClient();await db.auth.signUp({...values.data,options:{emailRedirectTo:`${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`}});
 redirect("/login?message=If registration is available for this email, you will receive a confirmation link. New accounts are customers only.");
}
export async function signOut(){const db=await createClient();await db.auth.signOut({scope:"global"});redirect("/login");}
