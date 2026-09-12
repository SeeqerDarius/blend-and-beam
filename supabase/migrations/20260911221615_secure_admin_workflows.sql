-- Default-deny access; never derive staff privileges from signup metadata.
create or replace function private.staff_member() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_roles ur join auth.users u on u.id=ur.user_id
 where ur.user_id=(select auth.uid()) and u.email_confirmed_at is not null
 and (u.banned_until is null or u.banned_until < now()));
$$;
create or replace function private.has_permission(permission_key text) returns boolean language sql stable security definer set search_path='' as $$
 select private.staff_member() and coalesce((select auth.jwt())->>'aal','')='aal2'
 and exists(select 1 from auth.sessions s where s.id::text=(select auth.jwt())->>'session_id' and s.user_id=(select auth.uid()))
 and exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions p on p.id=rp.permission_id where ur.user_id=(select auth.uid()) and p.key=permission_key);
$$;
revoke all on function private.staff_member() from public,anon,authenticated;
revoke all on function private.has_permission(text) from public,anon;
grant execute on function private.staff_member(),private.has_permission(text) to authenticated;

insert into public.permissions(key) values('admin.access'),('reviews.manage'),('content.manage'),('discounts.manage') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.name='Super Admin' on conflict do nothing;
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where
 (r.name='Admin' and p.key not in('staff.manage','settings.manage')) or
 (r.name='Inventory Manager' and p.key in('admin.access','products.manage','inventory.manage')) or
 (r.name='Fulfillment' and p.key in('admin.access','orders.manage')) or
 (r.name='Support' and p.key in('admin.access','customers.read','reviews.manage')) or
 (r.name='Sales' and p.key in('admin.access','orders.manage','customers.read','reports.read'))
 on conflict do nothing;

create or replace function public.staff_membership() returns boolean language sql stable security invoker set search_path='' as $$ select private.staff_member(); $$;
create or replace function public.has_staff_permission(permission_key text) returns boolean language sql stable security invoker set search_path='' as $$ select private.has_permission(permission_key); $$;
revoke all on function public.staff_membership(),public.has_staff_permission(text) from public,anon;
grant execute on function public.staff_membership(),public.has_staff_permission(text) to authenticated;

-- Staff assignments and permission definitions cannot be written via the client API.
revoke all on public.roles,public.permissions,public.role_permissions,public.user_roles from anon,authenticated;
grant select on public.roles,public.permissions,public.role_permissions,public.user_roles to authenticated;
create policy "staff role directory" on public.roles for select to authenticated using(private.has_permission('staff.manage'));
create policy "staff permission directory" on public.permissions for select to authenticated using(private.has_permission('staff.manage'));
create policy "staff permission mapping" on public.role_permissions for select to authenticated using(private.has_permission('staff.manage'));
create policy "staff assignment directory" on public.user_roles for select to authenticated using(private.has_permission('staff.manage'));

-- Reset policies and grants on commerce tables to explicit least privilege.
do $$ declare t text; p record; begin
 foreach t in array array['profiles','products','product_variants','product_images','product_categories','categories','brands','inventory','inventory_movements','orders','order_items','order_status_history','payments','payment_events','reviews','audit_logs','shipping_zones','discount_codes']
 loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t); end loop;
 end loop;
end $$;
-- Cost fields and internal notes are not available to public API readers.
grant select(id,name,slug,short_description,description,sku,brand_id,price_minor,compare_at_minor,currency,status,track_inventory,allow_backorder,weight_grams,warranty,seo_title,seo_description,is_featured,is_best_seller,published_at,created_at,updated_at) on public.products to anon,authenticated;
grant insert(name,slug,short_description,description,sku,brand_id,price_minor,compare_at_minor,status,track_inventory,allow_backorder,warranty,is_featured,is_best_seller),update(name,slug,short_description,description,sku,brand_id,price_minor,compare_at_minor,status,track_inventory,allow_backorder,warranty,is_featured,is_best_seller,updated_at) on public.products to authenticated;
create policy "visible products" on public.products for select to anon,authenticated using(status='active' or private.has_permission('products.manage'));
create policy "staff insert products" on public.products for insert to authenticated with check(private.has_permission('products.manage'));
create policy "staff update products" on public.products for update to authenticated using(private.has_permission('products.manage')) with check(private.has_permission('products.manage'));
-- anon needs this pure boolean helper for combined public/staff policies.
grant usage on schema private to anon;
grant execute on function private.has_permission(text),private.staff_member() to anon;

grant select on public.categories,public.brands,public.product_variants,public.product_images,public.product_categories to anon,authenticated;
grant insert,update,delete on public.categories,public.brands,public.product_variants,public.product_images,public.product_categories to authenticated;
create policy "visible categories" on public.categories for select using(is_active or private.has_permission('products.manage'));
create policy "visible brands" on public.brands for select using(is_active or private.has_permission('products.manage'));
create policy "visible variants" on public.product_variants for select using((status='active' and exists(select 1 from public.products p where p.id=product_id and p.status='active')) or private.has_permission('products.manage'));
create policy "visible images" on public.product_images for select using(exists(select 1 from public.products p where p.id=product_id and p.status='active') or private.has_permission('products.manage'));
create policy "visible category links" on public.product_categories for select using(exists(select 1 from public.products p where p.id=product_id and p.status='active') or private.has_permission('products.manage'));
do $$ declare t text; begin foreach t in array array['categories','brands','product_variants','product_images','product_categories'] loop
 execute format('create policy "staff catalog writes" on public.%I for all to authenticated using(private.has_permission(''products.manage'')) with check(private.has_permission(''products.manage''))',t);
end loop; end $$;

grant select on public.profiles to authenticated;
create policy "own profile" on public.profiles for select to authenticated using(id=(select auth.uid()) or private.has_permission('customers.read') or private.has_permission('staff.manage'));
create or replace function private.sync_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,email) values(new.id,new.email) on conflict(id) do update set email=excluded.email; return new; end $$;
revoke all on function private.sync_profile() from public,anon,authenticated;
create trigger sync_commerce_profile after insert or update of email on auth.users for each row execute function private.sync_profile();
insert into public.profiles(id,email) select id,email from auth.users on conflict(id) do update set email=excluded.email;

grant select on public.inventory,public.inventory_movements to authenticated;
create policy "staff inventory read" on public.inventory for select to authenticated using(private.has_permission('inventory.manage') or private.has_permission('products.manage') or private.has_permission('reports.read'));
create policy "staff movements read" on public.inventory_movements for select to authenticated using(private.has_permission('inventory.manage'));
alter table public.inventory add constraint inventory_nonnegative check(quantity>=0);
grant select(id,order_number,user_id,guest_email,guest_phone,status,payment_status,currency,subtotal_minor,discount_minor,shipping_minor,tax_minor,total_minor,shipping_address,customer_note,created_at,updated_at) on public.orders to authenticated;
create policy "order reads" on public.orders for select to authenticated using(user_id=(select auth.uid()) or private.has_permission('orders.manage') or private.has_permission('reports.read') or private.has_permission('payments.read'));
grant select(id,order_id,product_id,variant_id,product_name,sku,options,quantity,unit_price_minor,discount_minor,total_minor) on public.order_items to authenticated;
create policy "item reads" on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id));
grant select on public.order_status_history to authenticated;
create policy "history reads" on public.order_status_history for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id));
grant select(id,order_id,provider,reference,status,amount_minor,currency,verified_at,created_at) on public.payments to authenticated;
create policy "staff payments read" on public.payments for select to authenticated using(private.has_permission('payments.read'));
grant select on public.audit_logs to authenticated;
create policy "staff audit read" on public.audit_logs for select to authenticated using(private.has_permission('audit.read'));

grant select on public.reviews to anon,authenticated;
grant insert(product_id,user_id,rating,title,content),update(status) on public.reviews to authenticated;
create policy "review reads" on public.reviews for select using(status='approved' or user_id=(select auth.uid()) or private.has_permission('reviews.manage'));
create policy "customer pending review" on public.reviews for insert to authenticated with check(user_id=(select auth.uid()) and status='pending' and verified_purchase=false);
create policy "staff review moderation" on public.reviews for update to authenticated using(private.has_permission('reviews.manage')) with check(private.has_permission('reviews.manage'));
alter table public.reviews add constraint review_status_allowed check(status in('pending','approved','rejected'));
grant select on public.shipping_zones to anon,authenticated;
grant insert,update on public.shipping_zones to authenticated;
create policy "shipping reads" on public.shipping_zones for select using(is_active or private.has_permission('settings.manage'));
create policy "shipping manage" on public.shipping_zones for all to authenticated using(private.has_permission('settings.manage')) with check(private.has_permission('settings.manage'));
grant select,insert,update on public.discount_codes to authenticated;
create policy "discount manage" on public.discount_codes for all to authenticated using(private.has_permission('discounts.manage')) with check(private.has_permission('discounts.manage'));
alter table public.discount_codes add constraint discount_percentage_limit check(kind<>'percentage' or value<=100);

create table public.site_content(id uuid primary key default gen_random_uuid(),slug text unique not null,title text not null,body text not null default '',is_published boolean not null default false,updated_at timestamptz not null default now());
alter table public.site_content enable row level security;
grant select on public.site_content to anon,authenticated; grant insert,update on public.site_content to authenticated;
create policy "content reads" on public.site_content for select using(is_published or private.has_permission('content.manage'));
create policy "content writes" on public.site_content for all to authenticated using(private.has_permission('content.manage')) with check(private.has_permission('content.manage'));

-- Append-only audit trail records committed writes in the same transaction.
create or replace function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb;
begin row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),lower(tg_op),tg_table_name,coalesce(row_data->>'id',row_data->>'user_id'),jsonb_build_object('changed_fields',(select jsonb_agg(key) from jsonb_each(row_data) where tg_op<>'UPDATE' or value is distinct from to_jsonb(old)->key)));
return case when tg_op='DELETE' then old else new end; end $$;
revoke all on function private.audit_change() from public,anon,authenticated;
do $$ declare t text; begin foreach t in array array['products','categories','brands','product_variants','product_images','product_categories','inventory','orders','reviews','discount_codes','shipping_zones','site_content','user_roles'] loop
execute format('create trigger commerce_audit after insert or update or delete on public.%I for each row execute function private.audit_change()',t); end loop; end $$;

-- Mutations that require transactions never use direct client table updates.
create or replace function private.adjust_stock(p_product uuid,p_delta integer,p_reason text,p_variant uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare i public.inventory;
begin
if not private.has_permission('inventory.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
if p_delta is null or p_reason is null or p_delta=0 or abs(p_delta::bigint)>100000 or length(trim(p_reason)) not between 5 and 500 then raise exception 'Invalid adjustment'; end if;
if not exists(select 1 from public.products where id=p_product) or (p_variant is not null and not exists(select 1 from public.product_variants where id=p_variant and product_id=p_product)) then raise exception 'Invalid product or variant'; end if;
insert into public.inventory(product_id,variant_id,quantity) values(p_product,p_variant,0) on conflict(product_id,variant_id) do nothing;
select * into i from public.inventory where product_id=p_product and variant_id is not distinct from p_variant for update;
if i.quantity+p_delta<0 then raise exception 'Insufficient stock'; end if;
update public.inventory set quantity=quantity+p_delta where id=i.id;
insert into public.inventory_movements(inventory_id,quantity_delta,reason,actor_id) values(i.id,p_delta,trim(p_reason),auth.uid());
end $$;
create or replace function public.adjust_stock(p_product uuid,p_delta integer,p_reason text,p_variant uuid default null) returns void language sql security invoker set search_path='' as $$ select private.adjust_stock(p_product,p_delta,p_reason,p_variant); $$;

create or replace function private.transition_order(p_order uuid,p_status text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; allowed text[];
begin
if not private.has_permission('orders.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
select * into o from public.orders where id=p_order for update;
if not found then raise exception 'Order not found'; end if;
allowed:=case o.status
when 'pending' then array['cancelled']
when 'confirmed' then array['processing','cancelled']
when 'processing' then array['ready_for_dispatch','cancelled']
when 'ready_for_dispatch' then array['shipped','cancelled']
when 'shipped' then array['out_for_delivery']
when 'out_for_delivery' then array['delivered']
when 'delivered' then array['returned'] else array[]::text[] end;
if p_status is null or not (p_status=any(allowed)) then raise exception 'Invalid order transition'; end if;
if p_status<>'cancelled' and o.payment_status<>'paid' then raise exception 'Payment must be verified before fulfillment'; end if;
if p_note is null or length(trim(p_note)) not between 5 and 500 then raise exception 'A fulfillment note is required'; end if;
update public.orders set status=p_status::public.order_status,updated_at=now() where id=p_order;
insert into public.order_status_history(order_id,status,note,actor_id) values(p_order,p_status::public.order_status,p_note,auth.uid());
end $$;
create or replace function public.transition_order(p_order uuid,p_status text,p_note text) returns void language sql security invoker set search_path='' as $$ select private.transition_order(p_order,p_status,p_note); $$;

create or replace function private.assign_staff(p_email text,p_role uuid,p_remove boolean) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
if not private.has_permission('staff.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
perform pg_advisory_xact_lock(817423);
select id into target from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null;
if target is null then raise exception 'A confirmed account is required'; end if;
if target=auth.uid() then raise exception 'You cannot change your own roles'; end if;
if not exists(select 1 from public.roles where id=p_role) then raise exception 'Role not found'; end if;
if p_remove then
 if exists(select 1 from public.roles where id=p_role and name='Super Admin') and (select count(*) from public.user_roles where role_id=p_role)<=1 then raise exception 'The last owner cannot be removed'; end if;
 delete from public.user_roles where user_id=target and role_id=p_role;
else insert into public.user_roles(user_id,role_id) values(target,p_role) on conflict do nothing; end if;
end $$;
create or replace function public.assign_staff(p_email text,p_role uuid,p_remove boolean default false) returns void language sql security invoker set search_path='' as $$ select private.assign_staff(p_email,p_role,p_remove); $$;
revoke all on function private.adjust_stock(uuid,integer,text,uuid),private.transition_order(uuid,text,text),private.assign_staff(text,uuid,boolean),public.adjust_stock(uuid,integer,text,uuid),public.transition_order(uuid,text,text),public.assign_staff(text,uuid,boolean) from public,anon;
grant execute on function private.adjust_stock(uuid,integer,text,uuid),private.transition_order(uuid,text,text),private.assign_staff(text,uuid,boolean),public.adjust_stock(uuid,integer,text,uuid),public.transition_order(uuid,text,text),public.assign_staff(text,uuid,boolean) to authenticated;
-- SVG uploads can carry active content; accepted uploads are raster-only.
update storage.buckets set allowed_mime_types=array['image/jpeg','image/png','image/webp','image/avif'] where id='brands';
