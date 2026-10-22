import {z} from "zod";
import {toMinor} from "@/lib/product-draft";

export const PRODUCT_STATUSES=["draft","active","archived"] as const;
export type ProductStatus=typeof PRODUCT_STATUSES[number];
export const MAX_PRODUCT_IMAGES=6;

const productSchema=z.object({
 name:z.string().trim().min(1,"Enter a product name.").max(200),
 slug:z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,"Use lowercase letters, numbers and single hyphens.").max(150),
 sku:z.string().trim().min(1,"Enter a SKU.").max(200),
 price_minor:z.number().int().min(0).max(100000000),
 compare_at_minor:z.number().int().min(0).max(100000000).nullable(),
 cost_minor:z.number().int().min(0).max(100000000).nullable(),
 brand_id:z.uuid().nullable(),
 description:z.string().max(10000,"Keep the description under 10,000 characters."),
 warranty:z.string().trim().max(500),
 seo_title:z.string().max(60,"Keep the SEO title to 60 characters."),
 seo_description:z.string().max(160,"Keep the SEO description to 160 characters."),
 status:z.enum(PRODUCT_STATUSES),
 is_featured:z.boolean(),
 is_best_seller:z.boolean(),
 track_inventory:z.boolean(),
}).refine(p=>p.compare_at_minor===null||p.compare_at_minor>p.price_minor,{path:["compare_at_minor"],message:"The compare-at price must be higher than the price, or left blank."});
export type ProductFields=z.infer<typeof productSchema>;

// Parses the shared add/edit product form. Money is converted from GHS text to
// exact integer pesewas; blank optional amounts stay null (not zero).
export function parseProductForm(form:FormData):{data:ProductFields;categories:string[]}|{errors:Record<string,string>}{
 const errors:Record<string,string>={};
 const money=(field:string,required:boolean)=>{const raw=String(form.get(field)??"").trim().replace(/,/g,"");if(!raw){if(required)errors[field]="Enter a price in GHS.";return null}try{return toMinor(raw)}catch{errors[field]="Enter GHS with no more than two decimal places.";return null}};
 const price=money("price_minor",true),compareAt=money("compare_at_minor",false),cost=money("cost_minor",false);
 const categories=[...new Set(form.getAll("categories").map(String).filter(Boolean))];
 if(categories.length>20||categories.some(c=>!z.uuid().safeParse(c).success))errors.categories="Choose valid categories.";
 const parsed=productSchema.safeParse({
  name:String(form.get("name")??""),slug:String(form.get("slug")??""),sku:String(form.get("sku")??""),
  price_minor:price??0,compare_at_minor:compareAt,cost_minor:cost,
  brand_id:String(form.get("brand_id")??"")||null,
  description:String(form.get("description")??""),warranty:String(form.get("warranty")??""),
  seo_title:String(form.get("seo_title")??""),seo_description:String(form.get("seo_description")??""),
  status:String(form.get("status")??"draft"),
  is_featured:form.get("is_featured")==="on",is_best_seller:form.get("is_best_seller")==="on",track_inventory:form.get("track_inventory")==="on",
 });
 if(!parsed.success)for(const issue of parsed.error.issues){const key=String(issue.path[0]??"form");errors[key]??=key==="brand_id"?"Choose a valid brand.":key==="status"?"Choose a status.":issue.message}
 if(Object.keys(errors).length||!parsed.success)return {errors};
 return {data:parsed.data,categories};
}

// Explains why the guarded delete refused, using the reason raised by
// public.delete_product. Every blocked case can be archived instead.
export function deleteBlockReason(message:string){
 const reason=message.toLowerCase();
 if(reason.includes("order history"))return "It appears in past orders.";
 if(reason.includes("cart"))return "It is in a customer's cart.";
 if(reason.includes("review"))return "It has customer reviews.";
 if(reason.includes("stock movement"))return "It has stock movement history.";
 return null;
}

// Validates a requested image order against the product's current images.
export function validImageOrder(current:string[],requested:string[]){
 return requested.length===current.length&&new Set(requested).size===requested.length&&requested.every(id=>current.includes(id));
}

// Keeps the list search safe inside PostgREST's or() filter syntax.
export function searchTerm(raw:string|undefined){return (raw??"").replace(/[^\p{L}\p{N}\s\-_.]/gu," ").replace(/\s+/g," ").trim().slice(0,80)}
