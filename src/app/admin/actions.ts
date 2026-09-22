"use server";
import {redirect} from "next/navigation";import {revalidatePath,updateTag} from "next/cache";import {z} from "zod";import {requireStaff} from "@/lib/admin-auth";import {resources} from "@/lib/admin-resources";
import {prepareImage} from "@/lib/image-preparation";
import {createClient as createAdminClient} from "@supabase/supabase-js";
const uuid=z.string().uuid();
function done(section:string,error?:string):never{if(!error){revalidatePath("/admin","layout");revalidatePath("/","layout");updateTag("catalog");}redirect("/admin/"+section+(error?"?error="+encodeURIComponent(error):"?saved=1"));}
export async function saveResource(form:FormData){
 const section=String(form.get("resource")??"");const config=resources[section];if(!config)redirect("/access-denied");
 const {db}=await requireStaff(config.permission);
 const values:Record<string,unknown>={};for(const f of config.fields){
  if(f.key==="regions"){values[f.key]=form.getAll(f.key).map(String);continue;}
  const raw=String(form.get(f.key)??"");
  // A blank optional money field (e.g. no free-shipping threshold set) must
  // stay blank through to the schema, not collapse to 0 — 0 and "unset" mean
  // opposite things for a threshold, even though they coincide for a plain price.
  values[f.key]=f.type==="checkbox"?form.get(f.key)==="on":f.type==="money"?(raw===""?"":Math.round(Number(raw)*100)):raw;
 }
 if(section==="discounts"&&values.kind==="fixed")values.value=Math.round(Number(values.value)*100);
 const parsed=config.schema.safeParse(values);if(!parsed.success)done(section,"Check required fields, formats and numeric limits.");
 const id=String(form.get("id")??"");if(id&&!uuid.safeParse(id).success)done(section,"Invalid record.");
 const payload=parsed.data as Record<string,unknown>;
 if(section==="products"&&payload.status==="active")payload.published_at=new Date().toISOString();
 // Every resource has its own Insert/Update shape; a config-driven payload
 // can't be typed against one of them specifically, so it crosses into the
 // typed client as `never` (assignable to any expected shape) at this one point.
 const result=id?await db.from(config.table).update(payload as never).eq("id",id).select("id").single():await db.from(config.table).insert(payload as never).select("id").single();
 if(result.error)done(section,result.error.code==="23505"?"That name, slug, SKU or code is already in use.":"The record could not be saved. Check your permissions and inputs.");
 done(section);
}
export async function adjustStock(form:FormData){const {db}=await requireStaff("inventory.manage");const parsed=z.object({p_product:uuid,p_delta:z.coerce.number().int().min(-100000).max(100000).refine(v=>v!==0),p_reason:z.string().trim().min(5).max(500),p_variant:uuid.nullable()}).safeParse({p_product:form.get("product"),p_delta:form.get("delta"),p_reason:form.get("reason"),p_variant:form.get("variant")||null});if(!parsed.success)done("inventory","Select a product, a nonzero quantity and a reason of at least five characters.");const {error}=await db.rpc("adjust_stock",{...parsed.data,p_variant:parsed.data.p_variant??undefined});done("inventory",error?"Adjustment rejected. Check stock, variant and permissions.":undefined);}
export async function saveOrderNote(form:FormData){const {db}=await requireStaff("orders.manage");const parsed=z.object({p_order:uuid,p_note:z.string().trim().max(2000)}).safeParse({p_order:form.get("order"),p_note:form.get("note")});if(!parsed.success)done("orders","Invalid note.");const {error}=await db.rpc("set_order_note",parsed.data);done("orders",error?"Note could not be saved.":undefined);}
export async function transitionOrder(form:FormData){const {db}=await requireStaff("orders.manage");const parsed=z.object({p_order:uuid,p_status:z.enum(["confirmed","processing","ready_for_dispatch","shipped","out_for_delivery","delivered","cancelled","returned"]),p_note:z.string().trim().min(5).max(500)}).safeParse({p_order:form.get("order"),p_status:form.get("status"),p_note:form.get("note")});if(!parsed.success)done("orders","A valid status and fulfillment note are required.");const {error}=await db.rpc("transition_order",parsed.data);done("orders",error?"Transition rejected. The status may have changed, or payment is not verified.":undefined);}
export async function moderateReview(form:FormData){const {db}=await requireStaff("reviews.manage");const parsed=z.object({id:uuid,status:z.enum(["approved","rejected","pending"])}).safeParse({id:form.get("id"),status:form.get("status")});if(!parsed.success)done("reviews","Invalid review.");const {error}=await db.from("reviews").update({status:parsed.data.status}).eq("id",parsed.data.id).select("id").single();done("reviews",error?"Unable to moderate review.":undefined);}
// Grant is a two-step, honest flow rather than a silent "invite email":
// try the direct role grant first (works instantly for anyone who already
// has a confirmed account); only send a real Supabase invite email when no
// such account exists, and say plainly whether that email actually sent.
export async function inviteStaff(form:FormData){
 const {db}=await requireStaff("staff.manage");
 const parsed=z.object({email:z.string().trim().toLowerCase().email().max(254),role:uuid,operation:z.enum(["grant","remove"])}).safeParse({email:form.get("email"),role:form.get("role"),operation:form.get("operation")});
 if(!parsed.success)redirect("/admin/staff?error="+encodeURIComponent("Enter a valid email and choose a role."));
 const {email,role,operation}=parsed.data;
 if(operation==="remove"){
  const {error}=await db.rpc("assign_staff",{p_email:email,p_role:role,p_remove:true});
  revalidatePath("/admin/staff");
  redirect(error?"/admin/staff?error="+encodeURIComponent("Access could not be revoked. "+(error.message||"")):"/admin/staff?staffResult=revoked&email="+encodeURIComponent(email));
 }
 const {error:grantError}=await db.rpc("assign_staff",{p_email:email,p_role:role,p_remove:false});
 if(!grantError){revalidatePath("/admin/staff");redirect("/admin/staff?staffResult=granted&email="+encodeURIComponent(email));}
 if(!grantError.message?.toLowerCase().includes("confirmed account")){
  redirect("/admin/staff?error="+encodeURIComponent(grantError.message||"Access could not be granted."));
 }
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!serviceKey){
  redirect("/admin/staff?error="+encodeURIComponent(`${email} doesn't have an account yet, and email invites aren't configured on this deployment (missing SUPABASE_SERVICE_ROLE_KEY). Ask them to sign up at /login, then grant their role here once confirmed.`));
 }
 const admin=createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,serviceKey);
 const {error:inviteError}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:`${process.env.NEXT_PUBLIC_APP_URL}/login`});
 if(inviteError){
  redirect("/admin/staff?error="+encodeURIComponent(`Invite email to ${email} failed: ${inviteError.message}`));
 }
 redirect("/admin/staff?staffResult=invited&email="+encodeURIComponent(email));
}
export async function linkCategory(form:FormData){const {db}=await requireStaff("products.manage");const parsed=z.object({product_id:uuid,category_id:uuid}).safeParse({product_id:form.get("product"),category_id:form.get("category")});if(!parsed.success)done("products","Select a product and category.");const result=form.get("operation")==="remove"?await db.from("product_categories").delete().match(parsed.data):await db.from("product_categories").upsert(parsed.data);done("products",result.error?"Unable to update category.":undefined);}
export async function uploadProductImage(form:FormData){
 const {db}=await requireStaff("products.manage");const product=uuid.safeParse(form.get("product"));const alt=z.string().trim().min(3).max(200).safeParse(form.get("alt"));const file=form.get("image");if(!product.success||!alt.success||!(file instanceof File)||file.size===0||file.size>4*1024*1024)done("products","Choose a product, descriptive alt text and a PNG/JPEG/WebP image under 4 MB.");
 let prepared;try{prepared=await prepareImage(Buffer.from(await file.arrayBuffer()),file.type,{rotation:0,mode:"fit",aspect:.75,crop:null})}catch(error){done("products",error instanceof Error?error.message:"Invalid image.")}
 const bytes=prepared.prepared;const path=product.data+"/"+crypto.randomUUID()+".webp"; const {error}=await db.storage.from("products").upload(path,bytes,{contentType:"image/webp",upsert:false});
 if(error)done("products","Image upload failed.");
 const result=await db.from("product_images").insert({product_id:product.data,path,alt_text:alt.data});
 if(result.error){await db.storage.from("products").remove([path]);done("products","Image metadata could not be saved.");}done("products");
}

export async function collectPayment(form:FormData){const {db}=await requireStaff("payments.collect");const parsed=z.object({p_order:uuid,p_note:z.string().trim().min(5).max(500)}).safeParse({p_order:form.get("order"),p_note:form.get("note")});if(!parsed.success)done("orders","Enter a receipt note.");const {error}=await db.rpc("collect_cod_payment",parsed.data);done("orders",error?"Payment receipt rejected. Check permission and that this COD order is delivered.":undefined);}
