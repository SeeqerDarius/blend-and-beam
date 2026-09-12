import { requireAdmin } from "@/lib/admin/context";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/admin/format";

export default async function AdminAuditLogs() {
  await requireAdmin("audit.read");
  const supabase = await createClient();
  const { data: logs } = await supabase.from("audit_logs").select("id,actor_id,action,entity_type,entity_id,created_at").order("created_at", { ascending: false }).limit(200);

  const actorIds = [...new Set((logs ?? []).map((l) => l.actor_id).filter((id): id is string => !!id))];
  const { data: profiles } = actorIds.length ? await supabase.from("profiles").select("id,email").in("id", actorIds) : { data: [] as { id: string; email: string | null }[] };
  const emailByActor = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  return (
    <>
      <p className="eyebrow">SYSTEM RECORD</p>
      <h2>Audit logs</h2>
      <p className="fine-print">Every write to catalog, orders, inventory, discounts, content and staff assignments is recorded automatically.</p>
      <table className="admin-table">
        <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead>
        <tbody>
          {(logs ?? []).length === 0 ? (
            <tr><td colSpan={4}>No activity recorded yet.</td></tr>
          ) : (logs ?? []).map((log) => (
            <tr key={log.id}>
              <td>{formatDateTime(log.created_at)}</td>
              <td>{(log.actor_id && emailByActor.get(log.actor_id)) || log.actor_id || "System"}</td>
              <td>{log.action}</td>
              <td>{log.entity_type} {log.entity_id ? `#${log.entity_id.slice(0, 8)}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
