-- Move the original storefront catalog into the admin-managed source of truth.
insert into public.categories(name,slug,description,sort_order,is_active) values
 ('Salon chairs','salon-chairs','Comfort, elevated',10,true),
 ('Wash units','wash-units','A better rinse ritual',20,true),
 ('Professional tools','tools','Built for the daily craft',30,true),
 ('Beauty equipment','beauty-equipment','Treatment-room essentials',40,true),
 ('Barber chairs','barber-chairs','Classic form, modern comfort',50,true),
 ('Accessories','accessories','The finishing details',60,true),
 ('Salon furniture','salon-furniture','Storage and stations for daily service',70,true)
on conflict(slug) do update set name=excluded.name,description=excluded.description,sort_order=excluded.sort_order,is_active=true;

insert into public.products(name,slug,description,sku,price_minor,compare_at_minor,status,track_inventory,warranty,is_featured,is_best_seller,published_at) values
 ('Marlow Hydraulic Styling Chair','marlow-hydraulic-chair','A sculpted professional chair with supportive upholstery and smooth hydraulic height adjustment.','BB-MARLOW-CHAIR',485000,525000,'active',true,'12-month warranty',true,true,now()),
 ('Solace Ceramic Backwash Unit','solace-backwash-unit','A refined reclining wash station engineered for client comfort and dependable daily service.','BB-SOLACE-WASH',965000,null,'active',true,'12-month warranty',true,false,now()),
 ('Aero Pro Ionic Dryer','aero-pro-dryer','Fast, controlled drying with ionic technology and a balanced professional grip.','BB-AERO-DRYER',129900,null,'active',true,'12-month warranty',false,false,now()),
 ('Arc Mobile Salon Trolley','arc-salon-trolley','Quiet-glide storage that keeps every essential within easy reach.','BB-ARC-TROLLEY',179500,null,'active',true,'12-month warranty',false,false,now()),
 ('Form Classic Barber Chair','form-barber-chair','Classic proportions, full recline and a heavy-duty hydraulic base.','BB-FORM-BARBER',795000,null,'active',true,'12-month warranty',false,false,now()),
 ('Halo LED Station Mirror','halo-led-mirror','True-tone illumination and a crisp profile for modern styling stations.','BB-HALO-MIRROR',249000,null,'active',true,'12-month warranty',false,false,now())
on conflict(slug) do update set name=excluded.name,description=excluded.description,sku=excluded.sku,price_minor=excluded.price_minor,compare_at_minor=excluded.compare_at_minor,status=excluded.status,track_inventory=excluded.track_inventory,warranty=excluded.warranty,is_featured=excluded.is_featured,is_best_seller=excluded.is_best_seller,published_at=coalesce(public.products.published_at,excluded.published_at),updated_at=now();

insert into public.product_categories(product_id,category_id)
select p.id,c.id from (values
 ('marlow-hydraulic-chair','salon-chairs'),('solace-backwash-unit','wash-units'),('aero-pro-dryer','tools'),
 ('arc-salon-trolley','salon-furniture'),('form-barber-chair','barber-chairs'),('halo-led-mirror','accessories')
) link(product_slug,category_slug) join public.products p on p.slug=link.product_slug join public.categories c on c.slug=link.category_slug
on conflict do nothing;

insert into public.inventory(product_id,quantity,low_stock_threshold)
select p.id,10,2 from public.products p where p.slug in('marlow-hydraulic-chair','solace-backwash-unit','aero-pro-dryer','arc-salon-trolley','form-barber-chair','halo-led-mirror')
and not exists(select 1 from public.inventory i where i.product_id=p.id and i.variant_id is null);
