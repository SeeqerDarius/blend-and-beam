import {redirect} from "next/navigation";
import {StoreHeader} from "@/components/store-header";
import {setNewPassword} from "@/app/login/actions";
import {createClient} from "@/lib/supabase/server";

export const metadata={title:"Set your password",robots:{index:false,follow:false}};

export default async function SetupPassword({searchParams}:{searchParams:Promise<{error?:string}>}){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/login?error=Open the latest password or invite link to continue.");
 const q=await searchParams;
 return <><StoreHeader/><main className="auth-page"><section><p className="eyebrow">SECURE YOUR ACCOUNT</p><h1>Set your password</h1><p>Choose a unique password of at least 12 characters. New staff will set up an authenticator before their staff access works.</p>{q.error&&<p role="alert" className="form-error">{q.error.slice(0,250)}</p>}<form action={setNewPassword} className="stack-form"><label htmlFor="new-password">New password</label><input id="new-password" name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required/><button className="button button-dark">Save password</button></form></section></main></>;
}
