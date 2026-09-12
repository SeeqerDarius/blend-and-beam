"use server";
import {redirect} from "next/navigation";import {revalidatePath} from "next/cache";import {z} from "zod";import {requireStaff} from "@/lib/admin-auth";import {resources} from "@/lib/admin-resources";
const uuid=z.string().uuid();
function done(section:string,error?:string):never{if(!error){revalidatePath("/admin","layout");revalidatePath("/","layout");}redirect("/admin/"+section+(error?"?error="+encodeURIComponent(error):"?saved=1"));}
export async function saveResource(form:FormData){
 const section=String(form.get("resource")??"");const config=resources[section];if(!config)redirect("/access-denied");
 const {db}=await requireStaff(config.permission);
 const values:Record<string,unknown>={};for(const f of config.fields)values[f.key]=f.type==="checkbox"?form.get(f.key)==="on":String(form.get(f.key)??"");
 const parsed=config.schema.safeParse(values);if(!parsed.success)done(section,"Check required fields, formats and numeric limits.");
 const id=String(form.get("id")??"");if(id&&!uuid.safeParse(id).success)done(section,"Invalid record.");
 const payload=parsed.data as Record<string,unknown>;
 const result=id?await db.from(config.table).update(payload).eq("id",id).select("id").single():await db.from(config.table).insert(payload).select("id").single();
 if(result.error)done(section,result.error.code==="23505"?"That name, slug, SKU or code is already in use.":"The record could not be saved. Check your permissions and inputs.");
 done(section);
}
export async function adjustStock(form:FormData){const {db}=await requireStaff("inventory.manage");const parsed=z.object({p_product:uuid,p_delta:z.coerce.number().int().min(-100000).max(100000).refine(v=>v!==0),p_reason:z.string().trim().min(5).max(500),p_variant:uuid.nullable()}).safeParse({p_product:form.get("product"),p_delta:form.get("delta"),p_reason:form.get("reason"),p_variant:form.get("variant")||null});if(!parsed.success)done("inventory","Select a product, a nonzero quantity and a reason of at least five characters.");const {error}=await db.rpc("adjust_stock",parsed.data);done("inventory",error?"Adjustment rejected. Check stock, variant and permissions.":undefined);}
export async function transitionOrder(form:FormData){const {db}=await requireStaff("orders.manage");const parsed=z.object({p_order:uuid,p_status:z.enum(["processing","ready_for_dispatch","shipped","out_for_delivery","delivered","cancelled","returned"]),p_note:z.string().trim().min(5).max(500)}).safeParse({p_order:form.get("order"),p_status:form.get("status"),p_note:form.get("note")});if(!parsed.success)done("orders","A valid status and fulfillment note are required.");const {error}=await db.rpc("transition_order",parsed.data);done("orders",error?"Transition rejected. The status may have changed, or payment is not verified.":undefined);}
export async function moderateReview(form:FormData){const {db}=await requireStaff("reviews.manage");const parsed=z.object({id:uuid,status:z.enum(["approved","rejected","pending"])}).safeParse({id:form.get("id"),status:form.get("status")});if(!parsed.success)done("reviews","Invalid review.");const {error}=await db.from("reviews").update({status:parsed.data.status}).eq("id",parsed.data.id).select("id").single();done("reviews",error?"Unable to moderate review.":undefined);}
export async function assignStaff(form:FormData){const {db}=await requireStaff("staff.manage");const parsed=z.object({p_email:z.string().trim().email().max(254),p_role:uuid,p_remove:z.boolean()}).safeParse({p_email:form.get("email"),p_role:form.get("role"),p_remove:form.get("operation")==="remove"});if(!parsed.success)done("staff","Select a role and enter a confirmed account email.");const {error}=await db.rpc("assign_staff",parsed.data);done("staff",error?"Role change rejected. Use a confirmed account; you cannot change your own roles or remove the last owner.":undefined);}
export async function linkCategory(form:FormData){const {db}=await requireStaff("products.manage");const parsed=z.object({product_id:uuid,category_id:uuid}).safeParse({product_id:form.get("product"),category_id:form.get("category")});if(!parsed.success)done("products","Select a product and category.");const result=form.get("operation")==="remove"?await db.from("product_categories").delete().match(parsed.data):await db.from("product_categories").upsert(parsed.data);done("products",result.error?"Unable to update category.":undefined);}
export async function uploadProductImage(form:FormData){
 const {db}=await requireStaff("products.manage");const product=uuid.safeParse(form.get("product"));const alt=z.string().trim().min(3).max(200).safeParse(form.get("alt"));const file=form.get("image");if(!product.success||!alt.success||!(file instanceof File)||file.size===0||file.size>4*1024*1024)done("products","Choose a product, descriptive alt text and a PNG/JPEG/WebP image under 4 MB.");
 const bytes=new Uint8Array(await file.arrayBuffer());let ext="";if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)ext="jpg";else if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))ext="png";else if(new TextDecoder().decode(bytes.slice(0,4))==="RIFF"&&new TextDecoder().decode(bytes.slice(8,12))==="WEBP")ext="webp";
 if(!ext)done("products","Only PNG, JPEG and WebP images are accepted.");
 const path=product.data+"/"+crypto.randomUUID()+"."+ext;
 const {error}=await db.storage.from("products").upload(path,bytes,{contentType:ext==="jpg"?"image/jpeg":"image/"+ext,upsert:false});
 if(error)done("products","Image upload failed.");
 const result=await db.from("product_images").insert({product_id:product.data,path,alt_text:alt.data});
 if(result.error){await db.storage.from("products").remove([path]);done("products","Image metadata could not be saved.");}done("products");
}
