import {redirect} from "next/navigation";import {createClient} from "@/lib/supabase/server";import {StoreHeader} from "@/components/store-header";import {MfaForm} from "@/components/mfa-form";
export const metadata={title:"Account security",robots:{index:false,follow:false}};
export default async function Security(){const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect("/login");
const {data:member}=await db.rpc("staff_membership");return <><StoreHeader/><main className="auth-page"><section><p className="eyebrow">ACCOUNT SECURITY</p><h1>Two-step verification</h1><p>Use an authenticator app to protect your account. This is required before any staff access.</p><MfaForm staff={member===true}/></section></main></>;}
