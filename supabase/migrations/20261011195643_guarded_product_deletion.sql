-- Product removal is available only through this permission-checked function.
-- Keep order, cart, review, and inventory histories intact; staff can archive
-- a product instead when any of those records refer to it.
create or replace function private.delete_product(p_id uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  storage_paths text[];
begin
  if not private.has_permission('products.manage') then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  perform 1 from public.products where id = p_id for update;
  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.order_items oi
    left join public.product_variants pv on pv.id = oi.variant_id
    where oi.product_id = p_id or pv.product_id = p_id
  ) then
    raise exception 'Product is in order history; archive it instead' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.cart_items ci
    left join public.product_variants pv on pv.id = ci.variant_id
    where ci.product_id = p_id or pv.product_id = p_id
  ) then
    raise exception 'Product is in a customer cart' using errcode = '23503';
  end if;

  if exists (select 1 from public.reviews where product_id = p_id) then
    raise exception 'Product has customer reviews; archive it instead' using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.inventory_movements im
    join public.inventory i on i.id = im.inventory_id
    where i.product_id = p_id
  ) then
    raise exception 'Product has stock movement history; archive it instead' using errcode = '23503';
  end if;

  select coalesce(
    array_agg(distinct stored.path) filter (where stored.path is not null),
    array[]::text[]
  )
  into storage_paths
  from (
    select pi.path from public.product_images pi where pi.product_id = p_id
    union all
    select pi.original_path from public.product_images pi where pi.product_id = p_id
    union all
    select unnest(b.paths) from public.product_upload_batches b where b.product_id = p_id
  ) as stored(path);

  delete from public.product_upload_batches where product_id = p_id;
  delete from public.products where id = p_id;

  return storage_paths;
end;
$$;

revoke all on function private.delete_product(uuid) from public, anon, authenticated;
grant execute on function private.delete_product(uuid) to authenticated;

create or replace function public.delete_product(p_id uuid)
returns text[]
language sql
security invoker
set search_path = ''
as $$
  select private.delete_product(p_id);
$$;

revoke all on function public.delete_product(uuid) from public, anon;
grant execute on function public.delete_product(uuid) to authenticated;
