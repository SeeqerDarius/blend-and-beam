-- Fills gaps left by secure_admin_workflows for the admin workspace UI.

-- Cost and merchandising fields were left out of the direct write grant; the
-- row policies already gate the whole statement by products.manage, so widening
-- the writable column set here does not loosen who can write.
grant insert(cost_minor,weight_grams,seo_title,seo_description,published_at,currency),
      update(cost_minor,weight_grams,seo_title,seo_description,published_at,currency)
  on public.products to authenticated;

-- Direct SELECT grants are shared by anon and authenticated, so cost_minor and
-- other admin-only fields can never be added to them without leaking to
-- customers on their own visible (active) rows. Security-definer RPCs return
-- full rows instead, gated by the same has_permission() checks as everywhere else.
create or replace function private.admin_products() returns setof public.products
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_permission('products.manage') then return; end if;
  return query select * from public.products order by created_at desc;
end $$;
create or replace function public.admin_products() returns setof public.products
language sql stable security invoker set search_path = '' as $$ select * from private.admin_products(); $$;

create or replace function private.admin_order(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not (private.has_permission('orders.manage') or private.has_permission('payments.read') or private.has_permission('reports.read')) then return null; end if;
  select jsonb_build_object(
    'order', to_jsonb(o),
    'items', coalesce((select jsonb_agg(to_jsonb(oi)) from public.order_items oi where oi.order_id = o.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at) from public.order_status_history h where h.order_id = o.id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(pay)) from public.payments pay where pay.order_id = o.id), '[]'::jsonb)
  ) into result
  from public.orders o where o.id = p_order;
  return result;
end $$;
create or replace function public.admin_order(p_order uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.admin_order(p_order); $$;

create or replace function private.set_order_note(p_order uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_permission('orders.manage') then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_note is not null and length(p_note) > 2000 then raise exception 'Note is too long'; end if;
  update public.orders set admin_note = nullif(trim(coalesce(p_note, '')), ''), updated_at = now() where id = p_order;
  if not found then raise exception 'Order not found'; end if;
end $$;
create or replace function public.set_order_note(p_order uuid, p_note text) returns void
language sql security invoker set search_path = '' as $$ select private.set_order_note(p_order, p_note); $$;

-- Lets the admin shell render the nav for a staff member's role before they
-- complete MFA, without exposing any actual protected data pre-AAL2.
create or replace function private.my_permissions() returns text[]
language sql stable security definer set search_path = '' as $$
  select case when private.staff_member() then
    coalesce((select array_agg(distinct p.key) from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = (select auth.uid())), array[]::text[])
  else array[]::text[] end;
$$;
create or replace function public.my_permissions() returns text[]
language sql stable security invoker set search_path = '' as $$ select private.my_permissions(); $$;

revoke all on function
  private.admin_products(), private.admin_order(uuid), private.set_order_note(uuid,text), private.my_permissions()
  from public, anon, authenticated;
revoke all on function
  public.admin_products(), public.admin_order(uuid), public.set_order_note(uuid,text), public.my_permissions()
  from public, anon;
grant execute on function
  private.admin_products(), private.admin_order(uuid), private.set_order_note(uuid,text), private.my_permissions(),
  public.admin_products(), public.admin_order(uuid), public.set_order_note(uuid,text), public.my_permissions()
  to authenticated;

-- Support/Sales-style staff (customers.read) can look up a customer without
-- inheriting order or payment visibility; the Customers page needs their
-- delivery addresses too, scoped the same way.
create policy "staff address read" on public.addresses for select to authenticated using(private.has_permission('customers.read'));
