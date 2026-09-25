"use server";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {credentials,signupCredentials,safeNext,signInErrorMessage} from "@/lib/auth-validation";
export async function signIn(form:FormData){
 const values=credentials.safeParse({email:form.get("email"),password:form.get("password")});
 if(!values.success)redirect("/login?error=Enter a valid email and password");
 const db=await createClient();const {error}=await db.auth.signInWithPassword(values.data);
 if(error)redirect("/login?error="+encodeURIComponent(signInErrorMessage(error)));
 const {data:member}=await db.rpc("staff_membership");redirect(member===true?"/admin":safeNext(form.get("next")));
}
export async function signUp(form:FormData){
 const values=signupCredentials.safeParse({email:form.get("email"),password:form.get("password")});
 if(!values.success)redirect("/login?error=Use a valid email and a password of at least 12 characters.");
 const db=await createClient();const {data,error}=await db.auth.signUp({...values.data,options:{emailRedirectTo:`${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`}});
 if(error)redirect("/login?error=We could not start registration. Please retry, or use Forgot password if you already have an account.");
 if(data.session){const {data:member}=await db.rpc("staff_membership");redirect(member===true?"/account/security?next=/admin":"/account?welcome=1");}
 redirect("/login?message=Registration started. Check your inbox for the confirmation link before signing in. If it does not arrive, use Forgot password or contact support.");
}
export async function requestPasswordReset(form:FormData){
 const parsed=credentials.shape.email.safeParse(form.get("email"));
 if(!parsed.success)redirect("/login?error=Enter a valid email address to request a reset.");
 const db=await createClient();
 const {error}=await db.auth.resetPasswordForEmail(parsed.data,{redirectTo:`${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/account/setup-password`});
 if(error)redirect("/login?error=Password reset could not be requested. Please try again shortly.");
 redirect("/login?message=If an account can be reset for that email, a password reset link will arrive shortly.");
}
export async function setNewPassword(form:FormData){
 const parsed=signupCredentials.shape.password.safeParse(form.get("password"));
 if(!parsed.success)redirect("/account/setup-password?error=Use a password of at least 12 characters.");
 const db=await createClient();const {data:{user},error:userError}=await db.auth.getUser();
 if(userError||!user)redirect("/login?error=Your password link is no longer valid. Request a new one.");
 const {error}=await db.auth.updateUser({password:parsed.data});
 if(error)redirect("/account/setup-password?error=Password could not be updated. Please request a new link and try again.");
 const {data:member}=await db.rpc("staff_membership");
 redirect(member===true?"/account/security?next=/admin":"/account?passwordUpdated=1");
}
export async function signOut(){const db=await createClient();await db.auth.signOut({scope:"global"});redirect("/login");}
