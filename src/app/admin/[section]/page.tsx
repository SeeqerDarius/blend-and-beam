import {InventoryWorkspace} from "@/components/inventory-workspace";import {ReportsDashboard} from "@/components/reports-dashboard";import {ProductsWorkspace,type ProductsQuery} from "@/components/products/products-workspace";
import Link from "next/link";
import {notFound} from "next/navigation";
import {requireStaff} from "@/lib/admin-auth";
import {resources,transitions,GHANA_REGIONS,type Field} from "@/lib/admin-resources";
import {money} from "@/lib/catalog";
import {describeAudit} from "@/lib/audit";
import {SubmitButton} from "@/components/submit-button";
import {collectPayment,saveResource,adjustStock,transitionOrder,moderateReview,inviteStaff,saveOrderNote} from "../actions";
type Row=Record<string,unknown>;
const moneyColumns=new Set(["price_minor","compare_at_minor","cost_minor","unit_price_minor","total_minor","amount_minor","fee_minor","minimum_minor","free_shipping_threshold_minor"]);
function display(v:unknown,column?:string,row?:Row):string{
 if(v===null||v===undefined)return "—";
 if(typeof v==="boolean")return v?"Yes":"No";
 // discount_codes.value is pesewas for a Fixed code but a plain 1-100 percent
 // for a Percentage code, so it can't join the static moneyColumns set.
 if(column==="value"&&row?.kind==="fixed"&&typeof v==="number")return money(v);
 if(column==="value"&&row?.kind==="percentage"&&typeof v==="number")return `${v}%`;
 if(column&&moneyColumns.has(column)&&typeof v==="number")return money(v);
 return typeof v==="object"?JSON.stringify(v):String(v);
}
// React's purity lint flags Date.now() called directly during render, even
// in an async server component; keeping it in its own function sidesteps that.
function Table({rows,columns,edit,editQuery="",labels}:{rows:Row[];columns:string[];edit?:string;editQuery?:string;labels?:Record<string,Map<string,string>>}){return <div className="table-scroll"><table className="admin-table"><thead><tr>{columns.map(c=><th key={c} scope="col">{c==="product_id"?"product":moneyColumns.has(c)?c.replace("_minor","").replaceAll("_"," ")+" (GHS)":c.replaceAll("_"," ")}</th>)}{edit&&<th scope="col">Actions</th>}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={String(r.id??i)}>{columns.map(c=><td key={c}>{c==="status"&&typeof r[c]==="string"?<span className={`pill pill-${r[c]}`}>{String(r[c])}</span>:labels?.[c]?(labels[c].get(String(r[c]))??display(r[c],c,r)):display(r[c],c,r)}</td>)}{edit&&<td><div className="product-row-actions"><Link href={"/admin/"+edit+"?"+editQuery+"edit="+r.id}>Edit</Link></div></td>}</tr>):<tr><td colSpan={columns.length+1}>No records yet.</td></tr>}</tbody></table></div>}
function Select({name,label,rows,empty=false}:{name:string;label:string;rows:Row[];empty?:boolean}){return <label>{label}<select name={name} required={!empty} defaultValue=""><option value="">{empty?"Base product (no variant)":"Choose…"}</option>{rows.map(r=><option key={String(r.id)} value={String(r.id)}>{String(r.name??r.email??r.id)}</option>)}</select></label>}
function FieldInput({f,editing,products,brands,section}:{f:Field;editing:Row;products:Row[];brands:Row[];section:string}){
 if(f.key==="product_id")return <select name={f.key} defaultValue={String(editing[f.key]??"")} required><option value="">Choose product…</option>{products.map(p=><option key={String(p.id)} value={String(p.id)}>{String(p.name)}</option>)}</select>;
 if(f.key==="brand_id")return <select name={f.key} defaultValue={String(editing[f.key]??"")}><option value="">No brand</option>{brands.map(b=><option key={String(b.id)} value={String(b.id)}>{String(b.name)}</option>)}</select>;
 if(f.type==="region-multiselect"){const selected=new Set(Array.isArray(editing[f.key])?editing[f.key] as string[]:[]);return <div className="checkbox-grid">{GHANA_REGIONS.map(r=><label key={r} className="checkbox-item"><input type="checkbox" name="regions" value={r} defaultChecked={selected.has(r)}/>{r}</label>)}</div>;}
 if(f.type==="textarea")return <textarea name={f.key} defaultValue={String(editing[f.key]??"")} required={f.required} maxLength={30000} rows={6}/>;
 if(f.type==="select")return <select name={f.key} defaultValue={String(editing[f.key]??f.options?.[0])}>{f.options?.map(o=><option key={o}>{o}</option>)}</select>;
 if(f.type==="checkbox")return <input type="checkbox" name={f.key} defaultChecked={Boolean(editing[f.key])}/>;
 // discount_codes.value is money only for a Fixed code; a Percentage code
 // keeps it a plain 1-100 number, so this is the one field whose "is this
 // money" answer depends on a sibling field's value, not just its own type.
 const asMoney=f.type==="money"||(section==="discounts"&&f.key==="value"&&editing.kind==="fixed");
 const raw=editing[f.key];
 const value=raw!=null?(asMoney?Number(raw)/100:raw):(f.type==="number"||f.type==="money"?0:"");
 return <input name={f.key} type={f.type==="money"||f.type==="number"?"number":f.type??"text"} defaultValue={String(value)} required={f.required} min={f.type==="number"||f.type==="money"?0:undefined} step={asMoney?"0.01":f.type==="number"?1:undefined} maxLength={f.type==="number"||f.type==="money"?undefined:1000}/>;
}
type ReadTable="inventory"|"orders"|"profiles"|"payments"|"reviews"|"audit_logs"|"user_roles";
const readSections:Record<string,{title:string;permission:string;table:ReadTable;columns:string[]}>={
inventory:{title:"Inventory",permission:"inventory.manage",table:"inventory",columns:["id","product_id","variant_id","quantity","low_stock_threshold"]},
orders:{title:"Orders",permission:"orders.manage",table:"orders",columns:["id","order_number","status","payment_method","payment_status","total_minor","guest_email","shipping_address","created_at"]},
customers:{title:"Customers",permission:"customers.read",table:"profiles",columns:["id","email","full_name","phone","created_at"]},
payments:{title:"Payments",permission:"payments.read",table:"payments",columns:["id","reference","order_id","status","amount_minor","currency","verified_at"]},
reviews:{title:"Reviews",permission:"reviews.manage",table:"reviews",columns:["id","product_id","rating","title","content","status"]},
audit:{title:"Audit history",permission:"audit.read",table:"audit_logs",columns:["id","actor_id","action","entity_type","entity_id","created_at","metadata"]},
staff:{title:"Staff access",permission:"staff.manage",table:"user_roles",columns:["user_id","role_id"]},
reports:{title:"Reports",permission:"reports.read",table:"orders",columns:["id","status","payment_method","payment_status","total_minor","created_at"]}
};
export default async function Workspace({params,searchParams}:{params:Promise<{section:string}>;searchParams:Promise<ProductsQuery&{edit?:string;order?:string;page?:string;saved?:string;error?:string;range?:string;from?:string;to?:string;staffResult?:string;email?:string;product?:string}>}){
 const {section}=await params;const q=await searchParams;const config=resources[section];const read=readSections[section];if(!config&&!read)notFound();
 if(section==="inventory")return <InventoryWorkspace query={q}/>;
 if(section==="reports")return <ReportsDashboard query={q}/>;
 if(section==="products")return <ProductsWorkspace query={q}/>;
 const {db}=await requireStaff(config?.permission??read.permission);
 const page=Math.min(10000,Math.max(1,Number(q.page)||1));const start=(Math.floor(page)-1)*50;
 const columns=config?.columns??read.columns;const table=config?.table??read.table;
 // Variants are reached from a product: ?product=<id> scopes the list and
 // pre-selects that product when adding a variant.
 const parentProduct=section==="variants"&&q.product&&/^[0-9a-f-]{36}$/i.test(q.product)?q.product:null;
 let listQuery=db.from(table).select(columns.join(","),{count:"exact"});
 if(parentProduct)listQuery=listQuery.filter("product_id","eq",parentProduct);
 const result=await listQuery.order(columns.includes("created_at")?"created_at":columns.includes("id")?"id":columns[0],{ascending:false}).range(start,start+49);
 if(result.error)throw new Error("Unable to load this workspace. Confirm the security migration has been applied.");
 const rows=(result.data??[]) as unknown as Row[];
 let editing:Row=parentProduct?{product_id:parentProduct}:{};if(config&&q.edit){const id=/^[0-9a-f-]{36}$/i.test(q.edit)?q.edit:null;if(!id)notFound();const result=await db.from(config.table).select([...new Set(["id",...config.fields.map(f=>f.key)])].join(",")).eq("id",id).single();if(result.error||!result.data)notFound();editing=result.data as unknown as Row;}
 const needProducts=["variants","inventory"].includes(section);
 const productResult=needProducts?await db.from("products").select("id,name").order("name").limit(1000):null;
 const products=(productResult?.data??[]) as Row[];
 const productNames=new Map(products.map(p=>[String(p.id),String(p.name)]));
 const parentName=parentProduct?productNames.get(parentProduct):undefined;
 const variants=section==="inventory"?(await db.from("product_variants").select("id,name,product_id").limit(1000)).data??[]:[];
 const brands:Row[]=[];
 const scope=parentProduct?`product=${parentProduct}&`:"";
 return <><p className="eyebrow">STORE OPERATIONS</p>
 {parentProduct&&<p><Link className="text-link" href={`/admin/products?edit=${parentProduct}`}>← Back to {parentName??"product"}</Link></p>}
 <h1>{config?.title??read.title}{parentName?<>: <span className="heading-context">{parentName}</span></>:null}</h1>{q.saved&&<p role="status" className="operations-notice">Saved successfully.</p>}{q.error&&<p role="alert" className="form-error">{q.error.slice(0,300)}</p>}
 {section==="variants"&&!parentProduct&&<p>To work on one product&apos;s variants, open the product in <Link className="text-link" href="/admin/products">Products</Link> and choose Variants.</p>}
 {config&&<><p>{config.description}</p><details className="operations-card" open={Boolean(q.edit)||Boolean(parentProduct&&!rows.length)}><summary>{q.edit?"Edit record":"Create new"}</summary><form action={saveResource} className="operations-form"><input type="hidden" name="resource" value={section}/><input type="hidden" name="id" value={String(editing.id??"")}/>{parentProduct&&<input type="hidden" name="return_product" value={parentProduct}/>}{config.fields.map(f=>f.type==="region-multiselect"
  ?<fieldset key={f.key} className="checkbox-fieldset"><legend>{f.label}</legend><FieldInput f={f} editing={editing} products={products} brands={brands} section={section}/>{f.hint&&<small className="field-hint">{f.hint}</small>}</fieldset>
  :<label key={f.key}>{f.label}<FieldInput f={f} editing={editing} products={products} brands={brands} section={section}/>{f.hint&&<small className="field-hint">{f.hint}</small>}</label>
)}<SubmitButton>Save record</SubmitButton>{q.edit&&<Link href={"/admin/"+section+(parentProduct?`?product=${parentProduct}`:"")}>Cancel editing</Link>}</form></details></>}
 {section==="inventory"&&<><p>Adjustments are atomic and recorded with your account and reason. Stock cannot become negative.</p><form action={adjustStock} className="operations-form operations-card"><Select name="product" label="Product" rows={products}/><Select name="variant" label="Variant (must belong to product)" rows={variants} empty/><label>Quantity change<input name="delta" type="number" step="1" min="-100000" max="100000" required placeholder="10 or -2"/></label><label>Reason<input name="reason" minLength={5} maxLength={500} required/></label><SubmitButton>Record adjustment</SubmitButton></form></>}
 {section==="payments"&&<p>Online payments are provider-verified. Authorized staff can record payment for delivered COD orders from Orders. Refunds must be processed through Paystack; this screen does not issue refunds.</p>}
 {section==="staff"&&<><p>Staff accounts are created only by invitation and must use an email without an existing customer account. The invitation reserves the selected staff role. The invitee sets a password and configures two-step verification before staff access works. You cannot change your own roles.</p>
 {q.staffResult==="invited"&&<p role="status" className="operations-notice">✓ Staff setup link sent to {q.email}. Their selected role is reserved and becomes active after they confirm the invite and complete two-step verification.</p>}
 {q.staffResult==="revoked"&&<p role="status" className="operations-notice">✓ Access revoked for {q.email}.</p>}
 <form action={inviteStaff} className="operations-form operations-card"><label>Staff email<input name="email" type="email" required autoComplete="off"/></label><Select name="role" label="Staff role" rows={(await db.from("roles").select("id,name").order("name")).data??[]}/><label>Action<select name="operation"><option value="invite">Invite new staff account</option><option value="remove">Remove staff role</option></select></label><SubmitButton>Update staff access</SubmitButton></form></>}

 {section==="audit"?<AuditFeed rows={rows} db={db}/>:<Table rows={rows} columns={columns.filter(c=>c!=="id")} edit={config?section:undefined} editQuery={scope} labels={section==="variants"?{product_id:productNames}:undefined}/>}
 {section==="orders"&&rows.map(o=><details className="operations-card" key={String(o.id)}><summary>{String(o.order_number)} — fulfillment &amp; items</summary>{q.order===String(o.id)?<OrderDetail order={o}/>:<Link href={`/admin/orders?page=${page}&order=${o.id}`}>Load items and history</Link>}{o.payment_method==="cod"&&o.status==="delivered"&&o.payment_status==="pending"&&<form action={collectPayment} className="operations-form"><input type="hidden" name="order" value={String(o.id)}/><label>Payment receipt note<input name="note" minLength={5} maxLength={500} required/></label><SubmitButton>Record payment received</SubmitButton></form>}{(transitions[String(o.status)]??[]).length>0&&<form action={transitionOrder} className="operations-form"><input type="hidden" name="order" value={String(o.id)}/><label>Next status<select name="status">{(transitions[String(o.status)]??[]).map(s=><option key={s}>{s}</option>)}</select></label><label>Fulfillment note<input name="note" minLength={5} maxLength={500} required/></label><SubmitButton>Update fulfillment</SubmitButton></form>}</details>)}
 {section==="reviews"&&rows.map(row=><form action={moderateReview} className="operations-card operations-form" key={String(row.id)}><strong>{display(row.title)}</strong><input type="hidden" name="id" value={String(row.id)}/><label>Moderation<select name="status" defaultValue={String(row.status)}><option>pending</option><option>approved</option><option>rejected</option></select></label><SubmitButton>Save moderation</SubmitButton></form>)}
 {section==="inventory"&&<MovementHistory/>}
 <div className="operations-pagination">{page>1&&<Link href={"/admin/"+section+"?"+scope+"page="+(page-1)}>← Previous</Link>}<span>Page {page} · {result.count??0} records</span>{(result.count??0)>start+50&&<Link href={"/admin/"+section+"?"+scope+"page="+(page+1)}>Next →</Link>}</div>
 </>;
}
type OrderDetailData={order:{admin_note:string|null};items:Row[];history:Row[];payments:Row[]};
async function OrderDetail({order}:{order:Row}){
 const {db}=await requireStaff("orders.manage");const orderId=String(order.id);
 // admin_note and billing_address aren't in the orders SELECT grant (a
 // customer can see their own order row, and column grants can't be scoped
 // per-row), so the full detail comes from admin_order() instead.
 const {data,error}=await db.rpc("admin_order",{p_order:orderId});
 if(error||!data)throw new Error("Unable to load order details.");
 const detail=data as unknown as OrderDetailData;
 return <>
  <h3>Items</h3><Table rows={detail.items} columns={["product_name","sku","quantity","unit_price_minor","total_minor"]}/>
  {detail.payments.length>0&&<><h3>Payments</h3><Table rows={detail.payments} columns={["reference","provider","status","amount_minor","verified_at"]}/></>}
  <h3>Status history</h3><Table rows={detail.history} columns={["status","note","created_at"]}/>
  <h3>Internal note</h3>
  <form action={saveOrderNote} className="operations-form">
   <input type="hidden" name="order" value={orderId}/>
   <label>Staff-only note<textarea name="note" defaultValue={detail.order.admin_note??""} maxLength={2000} rows={3}/></label>
   <SubmitButton>Save note</SubmitButton>
  </form>
 </>;
}
async function AuditFeed({rows,db}:{rows:Row[];db:Awaited<ReturnType<typeof requireStaff>>["db"]}){
 const actorIds=[...new Set(rows.map(r=>r.actor_id).filter((id):id is string=>typeof id==="string"))];
 const {data:actors}=actorIds.length?await db.from("profiles").select("id,email,full_name").in("id",actorIds):{data:[] as {id:string;email:string|null;full_name:string|null}[]};
 const actorById=new Map((actors??[]).map(a=>[a.id,a.full_name||a.email||"Unknown"]));
 if(!rows.length)return <p>No activity recorded yet.</p>;
 return <ul className="audit-feed">{rows.map(r=>{
  const {verb,entity,label}=describeAudit({action:String(r.action),entity_type:String(r.entity_type),metadata:r.metadata});
  const actor=r.actor_id?actorById.get(String(r.actor_id))??"Unknown staff":"System";
  const when=r.created_at?new Date(String(r.created_at)).toLocaleString("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
  return <li key={String(r.id)}><time>{when}</time> — <strong>{actor}</strong> {verb} {entity}{label?<>: <em>{label}</em></>:null}</li>;
 })}</ul>;
}
async function MovementHistory(){const {db}=await requireStaff("inventory.manage");const result=await db.from("inventory_movements").select("id,inventory_id,quantity_delta,reason,actor_id,created_at").order("created_at",{ascending:false}).limit(50);if(result.error)throw new Error("Unable to load stock history.");return <><h2>Latest stock movements</h2><Table rows={result.data??[]} columns={["inventory_id","quantity_delta","reason","created_at"]}/></>}
