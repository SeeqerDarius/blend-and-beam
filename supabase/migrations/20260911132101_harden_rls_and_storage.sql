-- Keep privileged permission lookup outside the exposed public schema.
create schema if not exists private;
create or replace function private.has_permission(permission_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = (select auth.uid()) and p.key = permission_key
  )
$$;
revoke all on function public.has_permission(text) from public, anon, authenticated;
drop policy if exists "admin products" on public.products;
drop policy if exists "admin inventory" on public.inventory;
drop policy if exists "admin orders" on public.orders;
drop policy if exists "admin audit" on public.audit_logs;
create policy "admin products" on public.products for all to authenticated using(private.has_permission('products.manage')) with check(private.has_permission('products.manage'));
create policy "admin inventory" on public.inventory for all to authenticated using(private.has_permission('inventory.manage')) with check(private.has_permission('inventory.manage'));
create policy "admin orders" on public.orders for all to authenticated using(private.has_permission('orders.manage')) with check(private.has_permission('orders.manage'));
create policy "admin audit" on public.audit_logs for select to authenticated using(private.has_permission('audit.read'));
grant usage on schema private to authenticated;
grant execute on function private.has_permission(text) to authenticated;

-- Data API grants are explicit because automatic exposure is disabled.
grant usage on schema public to anon, authenticated;
grant select on public.products, public.product_variants, public.product_images, public.categories, public.brands to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.addresses, public.carts, public.cart_items, public.orders, public.order_items, public.order_status_history, public.payments, public.reviews to authenticated;

-- Buckets are public only for reads; writes remain policy-controlled.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('products','products',true,8388608,array['image/jpeg','image/png','image/webp','image/avif']),
('categories','categories',true,8388608,array['image/jpeg','image/png','image/webp','image/avif']),
('brands','brands',true,4194304,array['image/jpeg','image/png','image/webp','image/svg+xml']),
('content','content',true,12582912,array['image/jpeg','image/png','image/webp','image/avif']),
('avatars','avatars',false,4194304,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "staff insert commerce media" on storage.objects for insert to authenticated with check(bucket_id in('products','categories','brands','content') and private.has_permission('products.manage'));
create policy "staff update commerce media" on storage.objects for update to authenticated using(bucket_id in('products','categories','brands','content') and private.has_permission('products.manage')) with check(bucket_id in('products','categories','brands','content') and private.has_permission('products.manage'));
create policy "staff delete commerce media" on storage.objects for delete to authenticated using(bucket_id in('products','categories','brands','content') and private.has_permission('products.manage'));
create policy "customer avatar insert" on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "customer avatar select" on storage.objects for select to authenticated using(bucket_id='avatars' and owner_id=(select auth.uid())::text);
create policy "customer avatar update" on storage.objects for update to authenticated using(bucket_id='avatars' and owner_id=(select auth.uid())::text) with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
