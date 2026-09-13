alter table public.product_images add column if not exists original_path text;
alter table public.product_images add column if not exists preparation jsonb;
alter table public.product_images add column if not exists width integer;
alter table public.product_images add column if not exists height integer;
create table if not exists public.product_upload_batches(id uuid primary key,actor_id uuid not null references auth.users,paths text[] not null default '{}',product_id uuid references public.products,created_at timestamptz not null default now());
alter table public.product_upload_batches add column if not exists expired boolean not null default false;
alter table public.product_upload_batches enable row level security;
drop policy if exists "staff upload batches" on public.product_upload_batches;
create policy "staff upload batches" on public.product_upload_batches for all to authenticated using(actor_id=auth.uid() and private.has_permission('products.manage')) with check(actor_id=auth.uid() and private.has_permission('products.manage'));
grant select,insert,update,delete on public.product_upload_batches to authenticated;
create or replace function public.create_product_with_images(p_key uuid,p_product jsonb,p_images jsonb,p_category uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid; image jsonb; batch public.product_upload_batches;
begin
 if not private.has_permission('products.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into batch from public.product_upload_batches where id=p_key and actor_id=auth.uid() for update;
 if not found then raise exception 'Upload session missing'; end if;
 if batch.expired then raise exception 'Upload session expired; start a new product form'; end if;
 if batch.product_id is not null then return batch.product_id; end if;
 if jsonb_typeof(p_images) is distinct from 'array' or jsonb_array_length(p_images)>6 then raise exception 'Invalid images'; end if;
 if coalesce(length(trim(p_product->>'name')),0) not between 1 and 200 or coalesce(p_product->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_product->>'slug')>150 or coalesce(length(trim(p_product->>'sku')),0) not between 1 and 200 or length(p_product->>'description')>10000 or length(p_product->>'seo_title')>60 or length(p_product->>'seo_description')>160 then raise exception 'Invalid product'; end if;
 if (p_product->>'price_minor')::bigint not between 0 and 100000000 or (p_product->>'cost_minor')::bigint not between 0 and 100000000 then raise exception 'Invalid price'; end if;
 insert into public.products(name,slug,sku,price_minor,cost_minor,description,seo_title,seo_description,status,is_featured,is_best_seller,track_inventory,published_at)
 values(trim(p_product->>'name'),p_product->>'slug',trim(p_product->>'sku'),(p_product->>'price_minor')::bigint,(p_product->>'cost_minor')::bigint,p_product->>'description',p_product->>'seo_title',p_product->>'seo_description',(p_product->>'status')::public.product_status,(p_product->>'is_featured')::boolean,(p_product->>'is_best_seller')::boolean,(p_product->>'track_inventory')::boolean,case when p_product->>'status'='active' then now() end) returning id into pid;
 if p_category is not null then insert into public.product_categories(product_id,category_id) values(pid,p_category); end if;
 for image in select value from jsonb_array_elements(p_images) loop
  if not (image->>'path'=any(batch.paths)) or not(image->>'original_path'=any(batch.paths)) or (image->>'path') not like auth.uid()::text||'/'||p_key::text||'/%' or coalesce(length(trim(image->>'alt_text')),0) not between 3 and 200 then raise exception 'Invalid image metadata'; end if;
  if not exists(select 1 from storage.objects where bucket_id='products' and name=image->>'path') or not exists(select 1 from storage.objects where bucket_id='products' and name=image->>'original_path') then raise exception 'Image upload incomplete'; end if;
  insert into public.product_images(product_id,path,original_path,alt_text,sort_order,preparation,width,height) values(pid,image->>'path',image->>'original_path',trim(image->>'alt_text'),(image->>'sort_order')::int,image->'preparation',(image->>'width')::int,(image->>'height')::int);
 end loop;
 update public.product_upload_batches set product_id=pid where id=p_key;
 return pid;
end $$;
revoke all on function public.create_product_with_images(uuid,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.create_product_with_images(uuid,jsonb,jsonb,uuid) to authenticated;
