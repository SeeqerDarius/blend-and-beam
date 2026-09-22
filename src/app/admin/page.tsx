import Link from "next/link";
import {requireStaff,staffPermissions} from "@/lib/admin-auth";
import {adminLinks} from "@/lib/admin-resources";
import {money} from "@/lib/catalog";
import {describeAudit} from "@/lib/audit";
import {reportRange,type Report} from "@/lib/reporting";
type ActivityRow={id:string;actor_id:string|null;action:string;entity_type:string;created_at:string;metadata:unknown};

export default async function Admin(){
 const {db}=await requireStaff();
 const permissions=await staffPermissions();
 const available=adminLinks.slice(1).map(l=>({l,yes:permissions.has(l[2])}));
 const canSeeReports=permissions.has("reports.read");
 const canSeeAudit=permissions.has("audit.read");

 let report:Report|null=null;
 if(canSeeReports){
  const range=reportRange({range:"7"});
  const {data}=await db.rpc("commerce_report",{p_from:range.from,p_to:range.to});
  report=data as unknown as Report|null;
 }

 let activity:ActivityRow[]=[];
 const actorById=new Map<string,string>();
 if(canSeeAudit){
  const {data}=await db.from("audit_logs").select("id,actor_id,action,entity_type,created_at,metadata").order("created_at",{ascending:false}).limit(6);
  activity=(data??[]) as unknown as ActivityRow[];
  const actorIds=[...new Set(activity.map(r=>r.actor_id).filter((id):id is string=>typeof id==="string"))];
  if(actorIds.length){
   const {data:actors}=await db.from("profiles").select("id,email,full_name").in("id",actorIds);
   for(const a of actors??[])actorById.set(a.id,a.full_name||a.email||"Unknown");
  }
 }

 const kpis=report?.kpis.current;

 return <>
  <p className="eyebrow">BLEND &amp; BEAM</p>
  <h1>Store operations</h1>
  <p>Manage your catalog, stock and customer orders. Every section is permission-controlled.</p>
  <div className="operations-notice">Payment on delivery is available in enabled delivery zones. Online payments require Paystack configuration and verification.</div>

  {canSeeReports&&report&&<>
   <h2>Last 7 days</h2>
   <div className="operations-grid">
    <article className="operations-card"><h2>Revenue</h2><strong>{money(kpis?.revenue??0)}</strong></article>
    <article className="operations-card"><h2>Orders</h2><strong>{kpis?.orders??0}</strong></article>
    <article className="operations-card"><h2>Low stock</h2><strong>{report.inventory.low_stock}</strong></article>
    <article className="operations-card"><h2>Out of stock</h2><strong>{report.inventory.out_of_stock}</strong></article>
   </div>
   {!kpis?.orders&&<p className="fine-print">No orders in the last 7 days yet.</p>}
   <p><Link href="/admin/reports">View the full report →</Link></p>
  </>}

  {canSeeAudit&&<>
   <h2>Recent activity</h2>
   {activity.length===0?<p>No activity recorded yet.</p>:<ul className="audit-feed">
    {activity.map(r=>{
     const {verb,entity,label}=describeAudit(r);
     const actor=r.actor_id?actorById.get(r.actor_id)??"Unknown staff":"System";
     const when=new Date(r.created_at).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
     return <li key={r.id}><time>{when}</time> — <strong>{actor}</strong> {verb} {entity}{label?<>: <em>{label}</em></>:null}</li>;
    })}
   </ul>}
   <p><Link href="/admin/audit">View all activity →</Link></p>
  </>}

  <h2>Sections</h2>
  <div className="operations-grid">{available.filter(x=>x.yes).map(({l})=><Link className="operations-card" key={l[1]} href={l[1]}><h2>{l[0]}</h2><span>Open workspace →</span></Link>)}</div>
 </>;
}
