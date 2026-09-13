grant insert(original_path,preparation,width,height),update(original_path,preparation,width,height) on public.product_images to authenticated;
create or replace function public.set_primary_image(p_image uuid) returns void language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if not private.has_permission('products.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
 select product_id into pid from public.product_images where id=p_image;
 if pid is null then raise exception 'Image not found'; end if;
 perform 1 from public.products where id=pid for update;
 update public.product_images set sort_order=sort_order+1 where product_id=pid;
 update public.product_images set sort_order=0 where id=p_image;
end $$;
revoke all on function public.set_primary_image(uuid) from public,anon;
grant execute on function public.set_primary_image(uuid) to authenticated;
create or replace function public.register_product_upload(p_key uuid,p_paths text[]) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if not private.has_permission('products.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_key is null or cardinality(p_paths)>12 or exists(select 1 from unnest(p_paths) p where p not like auth.uid()::text||'/'||p_key::text||'/%' or length(p)>250) then raise exception 'Invalid paths'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,19));
 if exists(select 1 from public.product_upload_batches where id=p_key and (actor_id<>auth.uid() or expired)) then raise exception 'Upload session unavailable'; end if;
 select product_id into pid from public.product_upload_batches where id=p_key;
 if pid is not null then return pid; end if;
 insert into public.product_upload_batches(id,actor_id,paths) values(p_key,auth.uid(),p_paths) on conflict(id) do update set paths=coalesce((select array_agg(distinct p) from unnest(public.product_upload_batches.paths||excluded.paths) p),'{}'),created_at=now();
 return null;
end $$;
revoke all on function public.register_product_upload(uuid,text[]) from public,anon;
grant execute on function public.register_product_upload(uuid,text[]) to authenticated;
drop policy if exists "staff select commerce media" on storage.objects;
create policy "staff select commerce media" on storage.objects for select to authenticated using(bucket_id in ('products','categories','brands','content') and private.has_permission('products.manage'));

-- Claim abandoned sessions transactionally before Storage API cleanup. Claiming
-- prevents a delayed/retried product save from referencing files being removed.
create or replace function public.expire_product_uploads() returns table(id uuid,paths text[]) language plpgsql security definer set search_path='' as $$
begin
 if not private.has_permission('products.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
 return query update public.product_upload_batches b set expired=true where b.id in (select x.id from public.product_upload_batches x where x.actor_id=auth.uid() and x.product_id is null and (x.expired or x.created_at<now()-interval '24 hours') order by x.created_at limit 20 for update skip locked) returning b.id,b.paths;
end $$;
revoke all on function public.expire_product_uploads() from public,anon;
grant execute on function public.expire_product_uploads() to authenticated;
