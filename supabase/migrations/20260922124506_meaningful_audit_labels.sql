-- Human-readable audit labels computed at write time, so an entry stays
-- meaningful even after the underlying record is later renamed or deleted.
-- changed_fields is preserved as-is; this only adds `label` to metadata.
create or replace function private.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare row_data jsonb; label text;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  label := case tg_table_name
    when 'products' then row_data->>'name'
    when 'categories' then row_data->>'name'
    when 'brands' then row_data->>'name'
    when 'product_variants' then row_data->>'name'
    when 'product_images' then row_data->>'alt_text'
    when 'shipping_zones' then row_data->>'name'
    when 'discount_codes' then row_data->>'code'
    when 'site_content' then row_data->>'title'
    when 'orders' then row_data->>'order_number'
    when 'reviews' then coalesce(nullif(row_data->>'title', ''), 'Rating ' || (row_data->>'rating'))
    else null
  end;
  if label is null then
    if tg_table_name = 'inventory' then
      select p.name || coalesce(' — ' || v.name, '') into label
        from public.products p left join public.product_variants v on v.id = (row_data->>'variant_id')::uuid
        where p.id = (row_data->>'product_id')::uuid;
    elsif tg_table_name = 'product_categories' then
      select p.name || ' / ' || c.name into label
        from public.products p, public.categories c
        where p.id = (row_data->>'product_id')::uuid and c.id = (row_data->>'category_id')::uuid;
    elsif tg_table_name = 'user_roles' then
      select coalesce(pr.full_name, pr.email, 'Unknown user') || ' — ' || r.name into label
        from public.profiles pr, public.roles r
        where pr.id = (row_data->>'user_id')::uuid and r.id = (row_data->>'role_id')::uuid;
    end if;
  end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata) values(
    auth.uid(), lower(tg_op), tg_table_name, coalesce(row_data->>'id', row_data->>'user_id'),
    jsonb_build_object(
      'label', label,
      'changed_fields', (select jsonb_agg(key) from jsonb_each(row_data) where tg_op <> 'UPDATE' or value is distinct from to_jsonb(old)->key)
    )
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;
