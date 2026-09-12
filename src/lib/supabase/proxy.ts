import {createServerClient} from "@supabase/ssr";
import {NextResponse,type NextRequest} from "next/server";
export async function updateSession(request:NextRequest){
 let response=NextResponse.next({request});
 const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>request.cookies.getAll(),setAll(items){items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 const path=request.nextUrl.pathname;
 const {data:{user},error}=await db.auth.getUser();
 function go(pathname:string,next?:string){const url=request.nextUrl.clone();url.pathname=pathname;url.search="";if(next)url.searchParams.set("next",next);const out=NextResponse.redirect(url);response.cookies.getAll().forEach(c=>out.cookies.set(c));out.headers.set("Cache-Control","private, no-store");return out;}
 if(!user||error)return go("/login",path);
 if(path==="/admin"||path.startsWith("/admin/")){
  const member=await db.rpc("staff_membership");
  if(member.error||member.data!==true)return go("/access-denied");
  const {data:aal}=await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if(aal?.currentLevel!=="aal2")return go("/account/security","/admin");
  const allowed=await db.rpc("has_staff_permission",{permission_key:"admin.access"});
  if(allowed.error||allowed.data!==true)return go("/access-denied");
 }
 response.headers.set("Cache-Control","private, no-store");response.headers.set("X-Robots-Tag","noindex, nofollow");return response;
}
