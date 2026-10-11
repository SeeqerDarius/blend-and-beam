// One-off repair: re-prepare product images that asked for background removal
// before the cutout fix (265fda4), when the remove.bg result was discarded.
//
// Dry run (lists matching images, spends nothing):
//   node --env-file=.env.local scripts/reprocess-background-removal.mjs
// Process one image first, then everything:
//   node --env-file=.env.local scripts/reprocess-background-removal.mjs --apply --only <image-id>
//   node --env-file=.env.local scripts/reprocess-background-removal.mjs --apply
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and REMOVE_BG_API_KEY.
// Each processed image uses one remove.bg credit. Processed rows are marked with
// preparation.cutoutRepairedAt and skipped on later runs unless --force is passed.
import { createClient } from "@supabase/supabase-js";
import { prepareImage, cropSchema } from "../src/lib/image-preparation.ts";
import { removeImageBackground } from "../src/lib/hosted-background-removal.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const force = args.includes("--force");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const missing = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", ...(apply ? ["REMOVE_BG_API_KEY"] : [])]
  .filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const storage = db.storage.from("products");

let query = db
  .from("product_images")
  .select("id,product_id,path,original_path,preparation,products(name)")
  .eq("preparation->>backgroundRemoval", "remove-bg")
  .order("product_id");
if (only) query = query.eq("id", only);
const { data: rows, error } = await query;
if (error) {
  console.error(`Could not load product images: ${error.message}`);
  process.exit(1);
}
const targets = rows.filter((row) => force || !row.preparation?.cutoutRepairedAt);
const skipped = rows.length - targets.length;

const unrecorded = await db.from("product_images").select("id", { count: "exact", head: true }).is("preparation", null);

console.log(`${targets.length} image(s) to reprocess${skipped ? `, ${skipped} already repaired (use --force to redo)` : ""}.`);
for (const row of targets) console.log(`  ${row.id}  ${row.products?.name ?? row.product_id}`);
if (unrecorded.count)
  console.log(`\n${unrecorded.count} image(s) have no recorded preparation (uploaded via the "Upload product image" card or before preparation was tracked); they are not touched. Re-crop those in the admin if needed.`);

if (!apply) {
  console.log(`\nDry run only. Re-run with --apply to process (uses ${targets.length} remove.bg credit(s)).`);
  process.exit(0);
}

let ok = 0;
const failures = [];
for (const row of targets) {
  const label = `${row.id} (${row.products?.name ?? row.product_id})`;
  try {
    const sourcePath = row.original_path ?? row.path;
    const source = await storage.download(sourcePath);
    if (source.error) throw new Error(`original could not be downloaded: ${source.error.message}`);
    const bytes = Buffer.from(await source.data.arrayBuffer());
    const mime = source.data.type.split(";")[0];
    const options = cropSchema.parse(row.preparation);
    const cutout = await removeImageBackground(bytes, mime);
    const prepared = await prepareImage(bytes, mime, options, cutout);

    const path = `${row.product_id}/${crypto.randomUUID()}.webp`;
    const uploaded = await storage.upload(path, prepared.prepared, { contentType: "image/webp", upsert: false });
    if (uploaded.error) throw new Error(`upload failed: ${uploaded.error.message}`);
    const saved = await db
      .from("product_images")
      .update({
        path,
        original_path: sourcePath,
        width: prepared.width,
        height: prepared.height,
        preparation: { ...row.preparation, cutoutRepairedAt: new Date().toISOString() },
      })
      .eq("id", row.id);
    if (saved.error) {
      await storage.remove([path]);
      throw new Error(`metadata could not be saved: ${saved.error.message}`);
    }
    // Same cleanup as the admin re-crop: drop the superseded prepared file, never the original.
    if (row.original_path && row.path !== row.original_path) await storage.remove([row.path]);
    ok++;
    console.log(`✓ ${label}`);
  } catch (err) {
    failures.push(label);
    console.log(`✗ ${label}: ${err instanceof Error ? err.message : err}`);
  }
}

console.log(`\nDone: ${ok} reprocessed, ${failures.length} failed. The storefront catalog cache refreshes within 60 seconds.`);
if (failures.length) process.exit(1);
