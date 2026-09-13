-- Additive migration: preserve all existing orders, products and role assignments.
alter table public.shipping_zones add column if not exists cod_enabled boolean not null default false;
alter table public.orders add column if not exists payment_method text not null default 'online' check(payment_method in ('online','cod'));
alter table public.orders add column if not exists checkout_fingerprint text;
alter table public.inventory add column if not exists updated_at timestamptz not null default now();
grant select(payment_method) on public.orders to authenticated;
insert into public.permissions(key) values('payments.collect') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.name in ('Super Admin','Admin') and p.key='payments.collect' on conflict do nothing;
create index if not exists orders_reporting_idx on public.orders(created_at,payment_status);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists inventory_movements_reference_idx on public.inventory_movements(reference_id,reference_type);

create or replace function private.inventory_timestamp() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at:=now(); return new; end $$;
drop trigger if exists inventory_timestamp on public.inventory;
create trigger inventory_timestamp before update on public.inventory for each row execute function private.inventory_timestamp();

create or replace function public.place_cod_order(p_key uuid,p_items jsonb,p_address jsonb,p_zone uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); z public.shipping_zones; p public.products; inv public.inventory; o public.orders; item jsonb; qty integer; subtotal bigint:=0; shipping bigint; fingerprint text; order_id uuid:=gen_random_uuid();
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Sign in with a confirmed account' using errcode='42501'; end if;
 if p_key is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Invalid basket'; end if;
 if jsonb_typeof(p_address) is distinct from 'object' or coalesce(length(trim(p_address->>'name')),0) not between 2 and 150 or coalesce(p_address->>'phone','') !~ '^\+?[0-9 ()-]{9,20}$' or coalesce(length(trim(p_address->>'address')),0) not between 5 and 500 or coalesce(length(trim(p_address->>'city')),0) not between 2 and 100 or coalesce(length(p_address->>'region'),0) not between 2 and 100 or length(p_address::text)>2000 then raise exception 'Check delivery details'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,42));
 select * into o from public.orders where idempotency_key=actor::text||':'||p_key::text;
 if found then return jsonb_build_object('number',o.order_number,'total',o.total_minor); end if;
 select md5(jsonb_agg(value order by value->>'slug')::text||p_address::text||p_zone::text) into fingerprint from jsonb_array_elements(p_items);
 select * into o from public.orders where user_id=actor and checkout_fingerprint=fingerprint and created_at>now()-interval '5 minutes' and status<>'cancelled' order by created_at desc limit 1;
 if found then return jsonb_build_object('number',o.order_number,'total',o.total_minor); end if;
 if (select count(*) from public.orders where user_id=actor and created_at>now()-interval '10 minutes')>=5 then raise exception 'Please wait before placing another order'; end if;
 select * into z from public.shipping_zones where id=p_zone and is_active and cod_enabled for share;
 if not found or not ((p_address->>'region')=any(z.regions)) then raise exception 'Payment on delivery is unavailable for this location'; end if;
 if (select count(distinct value->>'slug') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then raise exception 'Duplicate basket lines'; end if;
 -- Stable product ordering avoids deadlocks across concurrent baskets.
 for item in select value from jsonb_array_elements(p_items) order by value->>'slug' loop
  if coalesce(item->>'quantity','') !~ '^[0-9]{1,2}$' then raise exception 'Invalid quantity'; end if; qty:=(item->>'quantity')::int;
  if qty not between 1 and 50 then raise exception 'Invalid quantity'; end if;
  select * into p from public.products where slug=item->>'slug' and status='active' for share;
  if not found then raise exception 'A product is no longer available'; end if;
  if p.track_inventory then
   select * into inv from public.inventory where product_id=p.id and variant_id is null for update;
   if not found or inv.quantity<qty then raise exception 'Insufficient stock for %',p.name; end if;
  end if;
  subtotal:=subtotal+p.price_minor*qty;
 end loop;
 shipping:=case when z.free_shipping_threshold_minor is not null and subtotal>=z.free_shipping_threshold_minor then 0 else z.fee_minor end;
 insert into public.orders(id,order_number,user_id,status,payment_status,payment_method,subtotal_minor,shipping_minor,total_minor,shipping_address,idempotency_key,checkout_fingerprint)
 values(order_id,'BB-'||upper(replace(order_id::text,'-','')),actor,'pending','pending','cod',subtotal,shipping,subtotal+shipping,jsonb_build_object('name',trim(p_address->>'name'),'phone',p_address->>'phone','address',trim(p_address->>'address'),'city',trim(p_address->>'city'),'region',p_address->>'region','gps',left(coalesce(p_address->>'gps',''),80)),actor::text||':'||p_key::text,fingerprint);
 for item in select value from jsonb_array_elements(p_items) order by value->>'slug' loop
  select * into p from public.products where slug=item->>'slug'; qty:=(item->>'quantity')::int;
  insert into public.order_items(order_id,product_id,product_name,sku,quantity,unit_price_minor,cost_minor,total_minor) values(order_id,p.id,p.name,p.sku,qty,p.price_minor,p.cost_minor,p.price_minor*qty);
  if p.track_inventory then
   update public.inventory set quantity=quantity-qty where product_id=p.id and variant_id is null returning * into inv;
   insert into public.inventory_movements(inventory_id,quantity_delta,reason,reference_type,reference_id,actor_id) values(inv.id,-qty,'COD order stock reservation','order_reservation',order_id,actor);
  end if;
 end loop;
 insert into public.order_status_history(order_id,status,note,actor_id) values(order_id,'pending','Payment on delivery; awaiting phone confirmation',actor);
 return jsonb_build_object('number','BB-'||upper(replace(order_id::text,'-','')),'total',subtotal+shipping);
end $$;
revoke all on function public.place_cod_order(uuid,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.place_cod_order(uuid,jsonb,jsonb,uuid) to authenticated;

create or replace function private.transition_order(p_order uuid,p_status text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; allowed text[]; movement record;
begin
 if not private.has_permission('orders.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into o from public.orders where id=p_order for update;
 if not found then raise exception 'Order not found'; end if;
 allowed:=case o.status when 'pending' then case when o.payment_method='cod' then array['confirmed','cancelled'] else array['cancelled'] end when 'confirmed' then array['processing','cancelled'] when 'processing' then array['ready_for_dispatch','cancelled'] when 'ready_for_dispatch' then array['shipped','cancelled'] when 'shipped' then array['out_for_delivery'] when 'out_for_delivery' then array['delivered'] when 'delivered' then array['returned'] else array[]::text[] end;
 if p_status is null or not(p_status=any(allowed)) then raise exception 'Invalid order transition'; end if;
 if p_status<>'cancelled' and o.payment_status<>'paid' and o.payment_method<>'cod' then raise exception 'Online payment must be verified'; end if;
 if p_note is null or length(trim(p_note)) not between 5 and 500 then raise exception 'A fulfillment note is required'; end if;
 if p_status='cancelled' and o.payment_method='cod' then
  for movement in select * from public.inventory_movements where reference_id=p_order and reference_type='order_reservation' order by inventory_id loop
   update public.inventory set quantity=quantity-movement.quantity_delta where id=movement.inventory_id;
   insert into public.inventory_movements(inventory_id,quantity_delta,reason,reference_type,reference_id,actor_id) values(movement.inventory_id,-movement.quantity_delta,'Cancelled COD reservation released','order_release',p_order,auth.uid());
  end loop;
 end if;
 update public.orders set status=p_status::public.order_status,updated_at=now() where id=p_order;
 insert into public.order_status_history(order_id,status,note,actor_id) values(p_order,p_status::public.order_status,p_note,auth.uid());
end $$;

create or replace function public.collect_cod_payment(p_order uuid,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
 if not private.has_permission('payments.collect') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_note is null or length(trim(p_note)) not between 5 and 500 then raise exception 'Receipt note required'; end if;
 select * into o from public.orders where id=p_order for update;
 if not found or o.payment_method<>'cod' or o.status<>'delivered' then raise exception 'Only delivered COD orders can be collected'; end if;
 if o.payment_status='paid' then return; end if;
 if o.payment_status<>'pending' then raise exception 'Invalid payment status'; end if;
 insert into public.payments(order_id,provider,reference,status,amount_minor,verified_at) values(p_order,'cod','cod:'||p_order::text,'paid',o.total_minor,now());
 update public.orders set payment_status='paid',updated_at=now() where id=p_order;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'cod_payment_received','orders',p_order::text,jsonb_build_object('amount_minor',o.total_minor,'note',trim(p_note)));
end $$;
revoke all on function public.collect_cod_payment(uuid,text) from public,anon;
grant execute on function public.collect_cod_payment(uuid,text) to authenticated;

-- Aggregate contact selections only: no customer identity or message content.
create table if not exists private.contact_counts(day date not null,slug text not null,channel text not null check(channel in ('call','whatsapp')),selections bigint not null default 0,primary key(day,slug,channel));
create or replace function public.record_contact_selection(p_slug text,p_channel text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_channel not in ('call','whatsapp') or p_channel is null or not exists(select 1 from public.products where slug=p_slug and status='active') then return; end if;
 insert into private.contact_counts(day,slug,channel,selections) values((now() at time zone 'Africa/Accra')::date,p_slug,p_channel,1) on conflict(day,slug,channel) do update set selections=least(private.contact_counts.selections+1,1000000);
end $$;
revoke all on function public.record_contact_selection(text,text) from public;
grant execute on function public.record_contact_selection(text,text) to anon,authenticated;
