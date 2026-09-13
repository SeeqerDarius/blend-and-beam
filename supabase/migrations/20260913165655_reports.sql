create or replace function public.commerce_report(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.has_permission('reports.read') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Choose a range of up to 367 days'; end if;
 with windows as (select p_from as start_day,p_to as end_day,p_to-p_from+1 as days),
 scoped as (select o.*,case when o.created_at>=(p_from::timestamp at time zone 'Africa/Accra') then 'current' else 'previous' end as period from public.orders o where o.created_at>=((p_from-(p_to-p_from+1))::timestamp at time zone 'Africa/Accra') and o.created_at<((p_to+1)::timestamp at time zone 'Africa/Accra')),
 paid as (select * from scoped where payment_status='paid' and status not in ('cancelled','returned')),
 sales as (select oi.*,o.period,(o.created_at at time zone 'Africa/Accra')::date as day,o.payment_method from public.order_items oi join paid o on o.id=oi.order_id),
 kpis as (select period,count(*) as orders,count(*) filter(where status='delivered') as delivered,count(*) filter(where status='pending') as pending,count(*) filter(where status='cancelled') as cancelled,count(*) filter(where status='returned') as returned,count(*) filter(where payment_status='paid') as paid,count(*) filter(where payment_status='pending') as unpaid from scoped group by period),
 financial as (select period,sum(total_minor) as revenue,sum(quantity) as units,sum(total_minor-cost_minor*quantity) filter(where cost_minor is not null) as gross_profit,sum(total_minor) filter(where cost_minor is not null) as costed_revenue,count(*) filter(where cost_minor is null) as uncosted_lines from sales group by period),
 stock as (select i.id,i.quantity,i.low_stock_threshold,p.name,p.sku,v.name as variant_name,coalesce(v.sku,p.sku) as display_sku,p.cost_minor from public.inventory i join public.products p on p.id=i.product_id left join public.product_variants v on v.id=i.variant_id where p.status='active' and p.track_inventory),
 category_sales as (select coalesce(c.name,'Uncategorised') as name,sum(s.total_minor) as revenue,sum(s.quantity) as units from sales s left join lateral (select pc.category_id from public.product_categories pc where pc.product_id=s.product_id order by pc.category_id limit 1) pc on true left join public.categories c on c.id=pc.category_id where s.period='current' group by c.name)
 select jsonb_build_object(
  'from',p_from,'to',p_to,'timezone','Africa/Accra',
  'kpis',coalesce((select jsonb_object_agg(k.period,to_jsonb(k)||coalesce(to_jsonb(f),'{}'::jsonb)||jsonb_build_object('sales_orders',(select count(*) from paid p where p.period=k.period))) from kpis k left join financial f on f.period=k.period),'{}'::jsonb),
  'trend',coalesce((select jsonb_agg(jsonb_build_object('day',d.day::date,'revenue',coalesce((select sum(s.total_minor) from sales s where s.period='current' and s.day=d.day::date),0)) order by d.day) from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d(day)),'[]'::jsonb),
  'top_revenue',coalesce((select jsonb_agg(to_jsonb(t)) from (select product_name as name,sku,sum(total_minor) as revenue,sum(quantity) as units from sales where period='current' group by product_id,product_name,sku order by revenue desc,sku limit 10)t),'[]'::jsonb),
  'top_units',coalesce((select jsonb_agg(to_jsonb(t)) from (select product_name as name,sku,sum(total_minor) as revenue,sum(quantity) as units from sales where period='current' group by product_id,product_name,sku order by units desc,sku limit 10)t),'[]'::jsonb),
  'payment_methods',coalesce((select jsonb_agg(to_jsonb(t)) from (select payment_method,count(*) as orders,count(*) filter(where status='delivered') as delivered,count(*) filter(where status='cancelled') as cancelled,count(*) filter(where payment_status='paid') as paid,coalesce(sum(total_minor) filter(where payment_status='paid' and status not in ('cancelled','returned')),0) as collected_total from scoped where period='current' group by payment_method)t),'[]'::jsonb),
  'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.revenue desc) from category_sales c),'[]'::jsonb),
  'stock',coalesce((select jsonb_agg(to_jsonb(s)) from (select name,display_sku as sku,variant_name,quantity,low_stock_threshold from stock where quantity<=low_stock_threshold order by quantity,name limit 50)s),'[]'::jsonb),
  'inventory',jsonb_build_object('value',(select sum(quantity*cost_minor) from stock where variant_name is null),'uncosted',(select count(*) from stock where cost_minor is null or variant_name is not null),'low_stock',(select count(*) from stock where quantity>0 and quantity<=low_stock_threshold),'out_of_stock',(select count(*) from stock where quantity<=0)),
  'geography',coalesce((select jsonb_agg(to_jsonb(t)) from (select coalesce(nullif(shipping_address->>'region',''),'Unspecified') as region,count(*) as orders,coalesce(sum(total_minor) filter(where payment_status='paid' and status not in ('cancelled','returned')),0) as collected_total from scoped where period='current' group by shipping_address->>'region' order by orders desc limit 20)t),'[]'::jsonb),
  'customers',jsonb_build_object('ordering_customers',(select count(distinct user_id) from scoped where period='current'),'repeat_customers',(select count(*) from (select user_id from scoped where period='current' and user_id is not null group by user_id having count(*)>1)t))
 ) into result;
 return result;
end $$;
revoke all on function public.commerce_report(date,date) from public,anon;
grant execute on function public.commerce_report(date,date) to authenticated;
