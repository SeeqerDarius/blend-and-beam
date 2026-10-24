"use server";
import {redirect} from "next/navigation";import {revalidatePath,updateTag} from "next/cache";import {z} from "zod";import {requireStaff} from "@/lib/admin-auth";import {resources} from "@/lib/admin-resources";
import {createClient as createAdminClient} from "@supabase/supabase-js";
import {sendEmail} from "@/lib/resend";
const uuid=z.string().uuid();
function done(section:string,error?:string,scope=""):never{if(!error){revalidatePath("/admin","layout");revalidatePath("/","layout");updateTag("catalog");}redirect("/admin/"+section+"?"+scope+(error?"error="+encodeURIComponent(error):"saved=1"));}
export async function saveResource(form:FormData){
 const section=String(form.get("resource")??"");const config=resources[section];if(!config)redirect("/access-denied");
 // Products are written only through the product editor's validated actions.
 if(section==="products")redirect("/admin/products");
 const {db}=await requireStaff(config.permission);
 const returnProduct=uuid.safeParse(form.get("return_product"));const scope=section==="variants"&&returnProduct.success?`product=${returnProduct.data}&`:"";
 const values:Record<string,unknown>={};for(const f of config.fields){
  if(f.key==="regions"){values[f.key]=form.getAll(f.key).map(String);continue;}
  const raw=String(form.get(f.key)??"");
  // A blank optional money field (e.g. no free-shipping threshold set) must
  // stay blank through to the schema, not collapse to 0 — 0 and "unset" mean
  // opposite things for a threshold, even though they coincide for a plain price.
  values[f.key]=f.type==="checkbox"?form.get(f.key)==="on":f.type==="money"?(raw===""?"":Math.round(Number(raw)*100)):raw;
 }
 if(section==="discounts"&&values.kind==="fixed")values.value=Math.round(Number(values.value)*100);
 const parsed=config.schema.safeParse(values);if(!parsed.success)done(section,"Check required fields, formats and numeric limits.",scope);
 const id=String(form.get("id")??"");if(id&&!uuid.safeParse(id).success)done(section,"Invalid record.",scope);
 const payload=parsed.data as Record<string,unknown>;
 // Every resource has its own Insert/Update shape; a config-driven payload
 // can't be typed against one of them specifically, so it crosses into the
 // typed client as `never` (assignable to any expected shape) at this one point.
 const result=id?await db.from(config.table).update(payload as never).eq("id",id).select("id").single():await db.from(config.table).insert(payload as never).select("id").single();
 if(result.error)done(section,result.error.code==="23505"?"That name, slug, SKU or code is already in use.":"The record could not be saved. Check your permissions and inputs.",scope);
 done(section,undefined,scope);
}
export async function adjustStock(form:FormData){const {db}=await requireStaff("inventory.manage");const parsed=z.object({p_product:uuid,p_delta:z.coerce.number().int().min(-100000).max(100000).refine(v=>v!==0),p_reason:z.string().trim().min(5).max(500),p_variant:uuid.nullable()}).safeParse({p_product:form.get("product"),p_delta:form.get("delta"),p_reason:form.get("reason"),p_variant:form.get("variant")||null});if(!parsed.success)done("inventory","Select a product, a nonzero quantity and a reason of at least five characters.");const {error}=await db.rpc("adjust_stock",{...parsed.data,p_variant:parsed.data.p_variant??undefined});done("inventory",error?"Adjustment rejected. Check stock, variant and permissions.":undefined);}
export async function saveOrderNote(form:FormData){const {db}=await requireStaff("orders.manage");const parsed=z.object({p_order:uuid,p_note:z.string().trim().max(2000)}).safeParse({p_order:form.get("order"),p_note:form.get("note")});if(!parsed.success)done("orders","Invalid note.");const {error}=await db.rpc("set_order_note",parsed.data);done("orders",error?"Note could not be saved.":undefined);}
export async function transitionOrder(form:FormData){const {db}=await requireStaff("orders.manage");const parsed=z.object({p_order:uuid,p_status:z.enum(["confirmed","processing","ready_for_dispatch","shipped","out_for_delivery","delivered","cancelled","returned"]),p_note:z.string().trim().min(5).max(500)}).safeParse({p_order:form.get("order"),p_status:form.get("status"),p_note:form.get("note")});if(!parsed.success)done("orders","A valid status and fulfillment note are required.");const {error}=await db.rpc("transition_order",parsed.data);done("orders",error?"Transition rejected. The status may have changed, or payment is not verified.":undefined);}
export async function moderateReview(form:FormData){const {db}=await requireStaff("reviews.manage");const parsed=z.object({id:uuid,status:z.enum(["approved","rejected","pending"])}).safeParse({id:form.get("id"),status:form.get("status")});if(!parsed.success)done("reviews","Invalid review.");const {error}=await db.from("reviews").update({status:parsed.data.status}).eq("id",parsed.data.id).select("id").single();done("reviews",error?"Unable to moderate review.":undefined);}
// Only this invitation action can grant a staff role. Customer signup remains
// separate, and confirmed customer accounts cannot be promoted in place.
// Supabase creates the pending staff account and one-time link; Resend delivers
// the email through the verified store domain.
export async function inviteStaff(form:FormData){
 const {db}=await requireStaff("staff.manage");
 const parsed=z.object({email:z.string().trim().toLowerCase().email().max(254),role:uuid,operation:z.enum(["invite","remove"])}).safeParse({email:form.get("email"),role:form.get("role"),operation:form.get("operation")});
 if(!parsed.success)redirect("/admin/staff?error="+encodeURIComponent("Enter a valid email and choose a role."));
 const {email,role,operation}=parsed.data;
 if(operation==="remove"){
  const {error}=await db.rpc("assign_staff",{p_email:email,p_role:role,p_remove:true});
  revalidatePath("/admin/staff");
  redirect(error?"/admin/staff?error="+encodeURIComponent("Access could not be revoked. "+(error.message||"")):"/admin/staff?staffResult=revoked&email="+encodeURIComponent(email));
 }
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!serviceKey){
  redirect("/admin/staff?error="+encodeURIComponent("Staff invitations aren't configured on this deployment (missing SUPABASE_SERVICE_ROLE_KEY)."));
 }
 if(!process.env.RESEND_API_KEY){
  redirect("/admin/staff?error="+encodeURIComponent("Staff invitations aren't configured on this deployment (missing RESEND_API_KEY)."));
 }
 const admin=createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
 const inviteReturn=new URL("/auth/callback",process.env.NEXT_PUBLIC_APP_URL!);inviteReturn.searchParams.set("next","/admin/setup-password");
 const {data:profile,error:profileError}=await admin.from("profiles").select("id").eq("email",email).maybeSingle();
 if(profileError)redirect("/admin/staff?error="+encodeURIComponent("Could not verify whether this email is already registered. No invitation was sent."));
 let linkType:"invite"|"magiclink"="invite";
 let userId:string|undefined;
 if(profile){
  const {data:userResult,error:userError}=await admin.auth.admin.getUserById(profile.id);
  if(userError||!userResult.user)redirect("/admin/staff?error="+encodeURIComponent("Could not verify this account. No invitation was sent."));
  if(!userResult.user.invited_at)redirect("/admin/staff?error="+encodeURIComponent("This email already has a customer or self-registered account. Staff access requires its own invitation-only account; use a different work email."));
  // invited_at is set by Supabase's admin invite flow. It distinguishes an
  // older invite-created account from a customer who registered themselves.
  const {error:roleWriteError}=await admin.from("user_roles").upsert({user_id:profile.id,role_id:role},{onConflict:"user_id,role_id",ignoreDuplicates:true});
  if(roleWriteError)redirect("/admin/staff?error="+encodeURIComponent("The invited account's staff role could not be reserved. No email was sent; contact support."));
  // Reissue the invitation for an unconfirmed invite-created account. If an
  // older invite was already accepted, use a magic link to continue setup.
  linkType=userResult.user.email_confirmed_at?"magiclink":"invite";userId=profile.id;
 }
 const {data:link,error:linkError}=await admin.auth.admin.generateLink({type:linkType,email,options:{redirectTo:inviteReturn.toString()}});
 if(linkError||!link?.properties?.action_link){
  const reason=linkError?.message?.toLowerCase().includes("already registered")?"This email already has an account. Staff access requires an invitation-only account with a different email.":"A fresh staff invitation link could not be created. No email was sent.";
  redirect("/admin/staff?error="+encodeURIComponent(reason));
 }
 // Supabase can return an action link pointed at the configured Site URL when
 // a redirect is rejected or the generated link omits the requested callback.
 // Pin the generated verification link to our staff setup callback so invitees
 // cannot accidentally land on the customer storefront.
 const actionLink=new URL(link.properties.action_link);
 const supabaseOrigin=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
 if(actionLink.origin!==supabaseOrigin||actionLink.pathname!=="/auth/v1/verify"){
  redirect("/admin/staff?error="+encodeURIComponent("The staff invitation link had an unexpected destination. No email was sent."));
 }
 actionLink.searchParams.set("redirect_to",inviteReturn.toString());
 if(!userId){
  userId=link.user?.id;
  if(!userId)redirect("/admin/staff?error="+encodeURIComponent("The invitation was created without an account reference. No email was sent; contact support."));
  const {error:roleError}=await admin.from("user_roles").upsert({user_id:userId,role_id:role},{onConflict:"user_id,role_id",ignoreDuplicates:true});
  if(roleError)redirect("/admin/staff?error="+encodeURIComponent("The invitation account was created, but its staff role could not be reserved. No email was sent; contact support."));
 }
 const sent=await sendEmail({
  to:email,
  subject:"You're invited to the Blend & Beam team",
  html:`<p>You've been invited to join the Blend & Beam admin team.</p><p><a href="${actionLink.toString()}">Accept your staff invite and set your password</a></p><p>After setting your password, you'll set up two-step verification. For future sign-ins, use the <a href="${new URL("/admin/login",process.env.NEXT_PUBLIC_APP_URL!).toString()}">Blend &amp; Beam admin login</a>.</p><p>If you weren't expecting this, you can ignore this email.</p>`,
 });
 if(!sent.ok){
  // Never put an authentication token in a redirect URL: URLs are retained in
  // browser history, analytics, and server logs. The pending account can be
  // retried after the email provider configuration is corrected.
  redirect("/admin/staff?error="+encodeURIComponent(`The invitation for ${email} is ready, but its email could not be sent (${sent.error}). Correct RESEND_API_KEY in Vercel Production, then retry this invitation to send a fresh setup link.`));
 }
 redirect("/admin/staff?staffResult=invited&email="+encodeURIComponent(email));
}

export async function collectPayment(form:FormData){const {db}=await requireStaff("payments.collect");const parsed=z.object({p_order:uuid,p_note:z.string().trim().min(5).max(500)}).safeParse({p_order:form.get("order"),p_note:form.get("note")});if(!parsed.success)done("orders","Enter a receipt note.");const {error}=await db.rpc("collect_cod_payment",parsed.data);done("orders",error?"Payment receipt rejected. Check permission and that this COD order is delivered.":undefined);}
