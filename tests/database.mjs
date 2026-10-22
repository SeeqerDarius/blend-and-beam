import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
let passed = 0;
await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz);
create table auth.sessions(id uuid primary key,user_id uuid);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
grant usage on schema auth to anon,authenticated;grant execute on all functions in schema auth to anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
create function public.rls_auto_enable() returns void language sql as $$select$$;`);
for (const file of readdirSync("supabase/migrations")
  .sort()
  .filter((f) => !f.includes("seed_storefront"))) {
  const sql = readFileSync("supabase/migrations/" + file, "utf8").replace(
    "create extension if not exists pgcrypto;",
    "",
  );
  try {
    await db.exec(sql);
  } catch (e) {
    console.error("Migration failed:", file, e.message);
    throw e;
  }
}
// Idempotent replay of new migrations.
for (const file of readdirSync("supabase/migrations")
  .sort()
  .filter((f) => f.startsWith("20260913")))
  await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
const customer = "00000000-0000-4000-8000-000000000001",
  owner = "00000000-0000-4000-8000-000000000002",
  session = "00000000-0000-4000-8000-000000000003",
  product = "00000000-0000-4000-8000-000000000004",
  zone = "00000000-0000-4000-8000-000000000005";
await db.exec(
  `insert into auth.users(id,email,email_confirmed_at) values('${customer}','customer@example.test',now()),('${owner}','owner@example.test',now());insert into auth.sessions values('${session}','${owner}');insert into public.user_roles select '${owner}',id from public.roles where name='Super Admin';insert into public.products(id,name,slug,sku,price_minor,cost_minor,status) values('${product}','Test chair','test-chair','TEST-CHAIR',12345,5000,'active');insert into public.inventory(product_id,quantity) values('${product}',10);insert into public.shipping_zones(id,name,regions,fee_minor,estimate,cod_enabled) values('${zone}','Test zone',array['Greater Accra'],500,'Test only',true);`,
);
async function as(user, aal = "aal1") {
  await db.exec("reset role");
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [user, JSON.stringify({ aal, session_id: session })],
  );
  await db.exec("set role authenticated");
}
async function test(name, fn) {
  try {
    await fn();
    console.log("PASS", name);
    passed++;
  } catch (e) {
    console.error("FAIL", name, e.message);
    throw e;
  }
}
async function reject(sql, args = []) {
  await assert.rejects(db.query(sql, args));
}
const address = {
  name: "Test customer",
  phone: "+233200000000",
  address: "Test address only",
  city: "Accra",
  region: "Greater Accra",
  gps: "",
};
const items = [{ slug: "test-chair", quantity: 2 }];
const key = "10000000-0000-4000-8000-000000000001";
await as(customer);
await test("Customer cannot read cost or change order/payment/inventory status", async () => {
  await reject("select cost_minor from public.products");
  await reject("update public.orders set payment_status='paid'");
  await reject("update public.inventory set quantity=999");
  await reject("select public.collect_cod_payment($1,'test receipt')", [
    product,
  ]);
  await reject("select public.commerce_report(current_date,current_date)");
});
await test("COD requires supported region and valid quantities", async () => {
  await reject("select public.place_cod_order($1,$2,$3,$4)", [
    key,
    items,
    { ...address, region: "Unsupported" },
    zone,
  ]);
  await reject("select public.place_cod_order($1,$2,$3,$4)", [
    key,
    [{ slug: "test-chair", quantity: -1 }],
    address,
    zone,
  ]);
  await reject("select public.place_cod_order($1,$2,$3,$4)", [
    key,
    [...items, ...items],
    address,
    zone,
  ]);
});
let number;
await test("COD creates unpaid pending order at trusted server prices", async () => {
  const res = await db.query(
    "select public.place_cod_order($1,$2,$3,$4) as receipt",
    [key, items, address, zone],
  );
  number = res.rows[0].receipt.number;
  assert.equal(res.rows[0].receipt.total, 25190);
  const o = await db.query(
    "select status,payment_status,payment_method from public.orders",
  );
  assert.deepEqual(o.rows[0], {
    status: "pending",
    payment_status: "pending",
    payment_method: "cod",
  });
});
await test("Retry and equivalent basket do not create duplicate orders", async () => {
  await db.query("select public.place_cod_order($1,$2,$3,$4)", [
    key,
    items,
    address,
    zone,
  ]);
  await db.query("select public.place_cod_order($1,$2,$3,$4)", [
    "10000000-0000-4000-8000-000000000002",
    items,
    address,
    zone,
  ]);
  assert.equal(
    (await db.query("select count(*)::int n from public.orders")).rows[0].n,
    1,
  );
});
await db.exec("reset role");
const oid = (
  await db.query("select id from public.orders where order_number=$1", [number])
).rows[0].id;
await test("Reservation deducts stock exactly once", async () =>
  assert.equal(
    (await db.query("select quantity from public.inventory")).rows[0].quantity,
    8,
  ));
await as(owner);
await test("Admin MFA remains mandatory", async () => {
  await reject(
    "select public.transition_order($1,'confirmed','Confirmed by phone')",
    [oid],
  );
  await reject("select public.commerce_report(current_date,current_date)");
});
await as(owner, "aal2");
await test("COD must be delivered before payment collection", async () => {
  await reject(
    "select public.collect_cod_payment($1,'Cash receipt confirmed')",
    [oid],
  );
  for (const status of [
    "confirmed",
    "processing",
    "ready_for_dispatch",
    "shipped",
    "out_for_delivery",
    "delivered",
  ])
    await db.query("select public.transition_order($1,$2,$3)", [
      oid,
      status,
      "Test lifecycle confirmation",
    ]);
  assert.equal(
    (
      await db.query("select payment_status from public.orders where id=$1", [
        oid,
      ])
    ).rows[0].payment_status,
    "pending",
  );
});
await test("Payment collection is idempotent and audited", async () => {
  await db.query("select public.collect_cod_payment($1,'Cash receipt test')", [
    oid,
  ]);
  await db.query("select public.collect_cod_payment($1,'Cash receipt retry')", [
    oid,
  ]);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.payments where order_id=$1",
        [oid],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.audit_logs where action='cod_payment_received'",
      )
    ).rows[0].n,
    1,
  );
});
await test("Reports reconcile paid revenue, units, profit and dates", async () => {
  const r = (
    await db.query("select public.commerce_report(current_date,current_date) r")
  ).rows[0].r;
  assert.equal(r.kpis.current.revenue, 24690);
  assert.equal(r.kpis.current.units, 2);
  assert.equal(r.kpis.current.gross_profit, 14690);
  assert.equal(r.payment_methods[0].collected_total, 25190);
});
await test("Protected self-role assignment rejected", async () => {
  const role = (
    await db.query("select id from public.roles where name='Super Admin'")
  ).rows[0].id;
  await reject("select public.assign_staff('owner@example.test',$1,true)", [
    role,
  ]);
});
await as(customer);
let cancelId;
await test("Different order can reserve stock and cancel safely", async () => {
  await db.query("select public.place_cod_order($1,$2,$3,$4)", [
    "10000000-0000-4000-8000-000000000003",
    [{ slug: "test-chair", quantity: 3 }],
    address,
    zone,
  ]);
  await db.exec("reset role");
  cancelId = (
    await db.query("select id from public.orders where status='pending'")
  ).rows[0].id;
  await as(owner, "aal2");
  await db.query(
    "select public.transition_order($1,'cancelled','Customer cancelled test')",
    [cancelId],
  );
  await reject(
    "select public.transition_order($1,'cancelled','Duplicate cancellation')",
    [cancelId],
  );
  await db.exec("reset role");
  assert.equal(
    (await db.query("select quantity from public.inventory")).rows[0].quantity,
    8,
  );
});
await as(owner,'aal2');
await test('Product creation with images is atomic and retry-safe',async()=>{
 const batch='20000000-0000-4000-8000-000000000001';const path=`${owner}/${batch}/one.webp`,original=`${owner}/${batch}/one-original.webp`;
 await db.query('select public.register_product_upload($1,$2)',[batch,[path,original]]);
 const payload={name:'Image test chair',slug:'image-test-chair',sku:'IMAGE-TEST',price_minor:10000,cost_minor:null,description:'Test image workflow',seo_title:'Test chair',seo_description:'Test description',status:'active',is_featured:true,is_best_seller:true,track_inventory:true};
 const images=[{path,original_path:original,alt_text:'Test chair full view',sort_order:0,width:300,height:400,preparation:{mode:'fit',rotation:0,aspect:.75,crop:null}}];
 await reject('select public.create_product_with_images($1,$2,$3,null)',[batch,payload,images]);
 assert.equal((await db.query("select count(*)::int n from public.products where sku='IMAGE-TEST'")).rows[0].n,0);
 await db.exec('reset role');await db.query("insert into storage.objects(bucket_id,name) values('products',$1),('products',$2)",[path,original]);await as(owner,'aal2');
 const a=await db.query('select public.create_product_with_images($1,$2,$3,null) id',[batch,payload,images]);const b=await db.query('select public.create_product_with_images($1,$2,$3,null) id',[batch,payload,images]);assert.equal(a.rows[0].id,b.rows[0].id);
 assert.equal((await db.query('select count(*)::int n from public.product_images where product_id=$1',[a.rows[0].id])).rows[0].n,1);
});
await test('Expired upload sessions cannot commit incomplete products',async()=>{
 const batch='20000000-0000-4000-8000-000000000002';await db.query('select public.register_product_upload($1,$2)',[batch,[]]);await db.exec('reset role');await db.query("update public.product_upload_batches set created_at=now()-interval '2 days' where id=$1",[batch]);await as(owner,'aal2');const expired=await db.query('select * from public.expire_product_uploads()');assert.equal(expired.rows[0].id,batch);await reject('select public.register_product_upload($1,$2)',[batch,[]]);
});
await test('Mismatched product variant is rejected',async()=>{
 await db.exec('reset role');await db.exec("insert into public.product_variants(id,product_id,name,sku) select '30000000-0000-4000-8000-000000000001',id,'Test variant','VARIANT-TEST' from public.products where sku='IMAGE-TEST'");await as(owner,'aal2');await reject("select public.adjust_stock($1,5,'Mismatch test','30000000-0000-4000-8000-000000000001')",[product]);
});
await test('Guarded delete refuses products with order history and requires staff MFA',async()=>{
 await as(customer);await reject('select public.delete_product($1)',[product]);
 await as(owner);await reject('select public.delete_product($1)',[product]);
 await as(owner,'aal2');
 await assert.rejects(db.query('select public.delete_product($1)',[product]),/order history/);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from public.products where id=$1',[product])).rows[0].n,1);
});
await test('Staff can reorder images; customers cannot touch them',async()=>{
 await db.exec('reset role');
 const pid=(await db.query("select id from public.products where sku='IMAGE-TEST'")).rows[0].id;
 await db.query("insert into public.product_images(product_id,path,original_path,alt_text,sort_order) values($1,'p/two.webp','p/two-original.webp','Second test view',1)",[pid]);
 // A customer's update is either refused outright or matches no rows under RLS.
 await as(customer);const attempt=await db.query("update public.product_images set sort_order=9 where product_id=$1 returning id",[pid]).catch(()=>({rows:[]}));
 assert.equal(attempt.rows.length,0);
 await as(owner,'aal2');
 await db.query("update public.product_images set sort_order=case when sort_order=0 then 1 else 0 end where product_id=$1",[pid]);
 assert.deepEqual((await db.query('select path from public.product_images where product_id=$1 order by sort_order',[pid])).rows.map(r=>r.path)[0],'p/two.webp');
});
await test('Guarded delete removes an unsold product with its images and variants and returns its files',async()=>{
 await as(owner,'aal2');
 const pid=(await db.query("select id from public.products where sku='IMAGE-TEST'")).rows[0].id;
 const paths=(await db.query('select public.delete_product($1) paths',[pid])).rows[0].paths;
 assert.ok(paths.includes('p/two.webp')&&paths.includes('p/two-original.webp'));
 assert.ok(paths.some(p=>p.endsWith('/one.webp'))&&paths.some(p=>p.endsWith('/one-original.webp')));
 await db.exec('reset role');
 for(const t of ['products','product_images','product_variants'])assert.equal((await db.query(`select count(*)::int n from public.${t} where ${t==='products'?'id':'product_id'}=$1`,[pid])).rows[0].n,0);
 assert.ok((await db.query("select count(*)::int n from public.audit_logs where entity_type='products' and action='delete' and entity_id=$1",[pid])).rows[0].n>=1);
 await as(owner,'aal2');await assert.rejects(db.query('select public.delete_product($1)',[pid]),/not found/i);
});
console.log(
  `${passed} database checks passed; migrations replayed idempotently.`,
);
await db.close();
