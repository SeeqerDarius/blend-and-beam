-- Single-row companion to admin_products() for the product edit page, so it
-- doesn't have to fetch the whole catalog to load one record.
create or replace function private.admin_product(p_id uuid) returns public.products
language plpgsql stable security definer set search_path = '' as $$
declare result public.products;
begin
  if not private.has_permission('products.manage') then return null; end if;
  select * into result from public.products where id = p_id;
  return result;
end $$;
create or replace function public.admin_product(p_id uuid) returns public.products
language sql stable security invoker set search_path = '' as $$ select private.admin_product(p_id); $$;

revoke all on function private.admin_product(uuid) from public, anon, authenticated;
revoke all on function public.admin_product(uuid) from public, anon;
grant execute on function private.admin_product(uuid), public.admin_product(uuid) to authenticated;
