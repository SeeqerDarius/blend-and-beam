import {cache} from "react";
import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const requireStaff=cache(async function requireStaff(permission = "admin.access") {
 const db = await createClient();
 const {data:{user},error} = await db.auth.getUser();
 if(error || !user || !user.email_confirmed_at) redirect("/login?next=/admin");
 const member = await db.rpc("staff_membership");
 if(member.error || member.data !== true) redirect("/access-denied");
 const {data:aal,error:aalError} = await db.auth.mfa.getAuthenticatorAssuranceLevel();
 if(aalError || aal?.currentLevel !== "aal2") redirect("/account/security?next=/admin");
 const allowed = await db.rpc("has_staff_permission",{permission_key:permission});
 if(allowed.error || allowed.data !== true) redirect("/access-denied");
 return {db,user};
});
export const staffPermissions=cache(async()=>{const {db}=await requireStaff();const {data,error}=await db.rpc("my_permissions");if(error)throw new Error("Permissions could not be loaded.");return new Set(data??[])});
