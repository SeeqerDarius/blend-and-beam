/* eslint-disable @next/next/no-img-element -- Thumbnails are local object URLs or already-prepared storage images shown at natural ratio. */
"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addProductImage,
  createProduct,
  deleteProduct,
  removeProductImage,
  reorderProductImages,
  setProductStatus,
  stageProductImage,
  updateImageAlt,
  updateProduct,
  updateProductImage,
  type ImageResult,
  type ProductResult,
  type StagedImage,
} from "@/app/admin/product-actions";
import { ImageWorkbench, NO_PREP, type Prep } from "@/components/products/image-workbench";
import { draftCopy, slugify } from "@/lib/product-draft";
import type { AdminProductImage } from "@/lib/product-images";
import { MAX_PRODUCT_IMAGES, type ProductStatus } from "@/lib/product-form";
import { money, products as presentationProducts } from "@/lib/catalog";

export type ProductInitial = {
  id?: string;
  name: string;
  slug: string;
  sku: string;
  price: string;
  compareAt: string;
  cost: string;
  brand_id: string;
  categories: string[];
  description: string;
  warranty: string;
  seo_title: string;
  seo_description: string;
  status: ProductStatus;
  is_featured: boolean;
  is_best_seller: boolean;
  track_inventory: boolean;
};
type Option = { id: string; name: string };
type Variant = { id: string; name: string; sku: string; price_minor: number | null; status: string };
type Staged = { key: string; file: File; url: string; alt: string; altEdited: boolean; prep: Prep };

const STATUS_COPY: Record<ProductStatus, { label: string; help: string }> = {
  draft: { label: "Draft", help: "Hidden from the store while you prepare it." },
  active: { label: "Active", help: "Visible in the store and available to order." },
  archived: { label: "Archived", help: "Hidden from the store. Orders, reviews and stock history are kept." },
};

function defaultAlt(name: string, index: number) {
  const base = name.trim().replace(/\s+/g, " ") || "Product";
  const suffix = index === 0 ? " — primary image" : ` — image ${index + 1}`;
  return `${base.slice(0, 200 - suffix.length)}${suffix}`;
}

function hrefWith(listHref: string, params: Record<string, string>) {
  const url = new URL(listHref, "http://local");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.pathname + url.search;
}

export function ProductEditor({
  mode,
  product,
  categories,
  brands,
  images: initialImages = [],
  variants = [],
  stock,
  backgroundRemovalAvailable,
  listHref,
  notice: initialNotice,
}: {
  mode: "create" | "edit";
  product: ProductInitial;
  categories: Option[];
  brands: Option[];
  images?: AdminProductImage[];
  variants?: Variant[];
  stock?: { quantity: number; low: number } | null;
  backgroundRemovalAvailable: boolean;
  listHref: string;
  notice?: string;
}) {
  const router = useRouter();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const editing = mode === "edit";

  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);
  const [seoTitle, setSeoTitle] = useState(product.seo_title);
  const [seoDescription, setSeoDescription] = useState(product.seo_description);
  const touched = useRef(new Set<string>(editing ? ["slug", "seo_title", "seo_description"] : []));
  const [status, setStatus] = useState<ProductStatus>(product.status);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ProductResult>({});
  const [notice, setNotice] = useState(initialNotice ?? "");
  const sessionKey = useRef("");
  const lock = useRef(false);

  const [staged, setStaged] = useState<Staged[]>([]);
  const [saved, setSaved] = useState<AdminProductImage[]>(initialImages);
  const [selected, setSelected] = useState<string | null>(null);
  const [imageBusy, startImageWork] = useTransition();
  const [imageMessage, setImageMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const objectUrls = useRef<string[]>([]);
  const [deleteState, setDeleteState] = useState<{ busy?: boolean; blocked?: string; error?: string }>({});

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    const urls = objectUrls.current;
    return () => urls.forEach(URL.revokeObjectURL);
  }, []);

  function close() {
    if (saving) return;
    if (dirty && !window.confirm("Discard your unsaved changes to this product?")) return;
    dialog.current?.close();
    router.push(listHref, { scroll: false });
  }

  function checkedCategories() {
    return Array.from(formRef.current?.querySelectorAll<HTMLInputElement>("input[name=categories]:checked") ?? []).map((i) => i.value);
  }

  function autofill(nextName: string, categoryIds: string[]) {
    const category = categories.find((c) => c.id === categoryIds[0])?.name ?? "";
    const copy = draftCopy(nextName, category, "");
    if (!touched.current.has("slug")) setSlug(slugify(nextName));
    if (!touched.current.has("seo_title")) setSeoTitle(copy.seo_title);
    if (!touched.current.has("seo_description")) setSeoDescription(copy.seo_description);
  }

  type ControlProps = { id: string; "aria-describedby"?: string; "aria-invalid"?: true };
  // Labels hold only the field name; hints and errors are linked by
  // aria-describedby so screen readers announce them after the name.
  function field(name: string, label: string, control: (p: ControlProps) => React.ReactNode, opts: { hint?: React.ReactNode; className?: string } = {}) {
    const id = `${titleId}-${name}`;
    const hintId = opts.hint ? `${id}-hint` : undefined;
    const errorId = result.errors?.[name] ? `${id}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
    return (
      <div className={`field${opts.className ? ` ${opts.className}` : ""}`}>
        <label htmlFor={id}>{label}</label>
        {control({ id, "aria-describedby": describedBy, "aria-invalid": errorId ? true : undefined })}
        {opts.hint && (
          <small id={hintId} className="field-hint">
            {opts.hint}
          </small>
        )}
        {errorId && (
          <small id={errorId} className="form-error">
            {result.errors![name]}
          </small>
        )}
      </div>
    );
  }
  const groupError = (name: string) =>
    result.errors?.[name] ? (
      <small className="form-error" role="alert">
        {result.errors[name]}
      </small>
    ) : null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setResult({});
    setNotice("");
    const form = new FormData(e.currentTarget);
    try {
      if (editing) {
        form.set("id", product.id!);
        const res = await updateProduct(form);
        setResult(res);
        if (res.id && !res.error) {
          setDirty(false);
          setNotice("Changes saved.");
          router.refresh();
        }
        return;
      }
      if (!sessionKey.current) sessionKey.current = crypto.randomUUID();
      form.set("key", sessionKey.current);
      const images: StagedImage[] = [];
      for (const [i, p] of staged.entries()) {
        setProgress(`Preparing image ${i + 1} of ${staged.length}…`);
        const upload = new FormData();
        upload.set("key", sessionKey.current);
        upload.set("imageKey", p.key);
        upload.set("alt", p.altEdited ? p.alt : defaultAlt(name, i));
        upload.set("file", p.file);
        upload.set("options", JSON.stringify(p.prep));
        const res = await stageProductImage(upload);
        if (res.error) {
          setResult({ error: res.error });
          return;
        }
        if (res.id) {
          router.replace(hrefWith(listHref, { edit: res.id, created: "1" }), { scroll: false });
          return;
        }
        if (res.image) images.push({ ...res.image, sort_order: i });
      }
      form.set("images", JSON.stringify(images));
      setProgress("Saving product…");
      const res = await createProduct(form);
      setResult(res);
      if (res.id) {
        setDirty(false);
        router.replace(hrefWith(listHref, { edit: res.id, created: res.error ? "partial" : "1" }), { scroll: false });
      }
    } catch {
      setResult({ error: "The connection was interrupted. Try again; nothing will be duplicated." });
    } finally {
      lock.current = false;
      setSaving(false);
      setProgress("");
    }
  }

  // ---- Images ----
  const count = editing ? saved.length : staged.length;
  function applyImageResult(res: ImageResult, success: string) {
    if (res.images) setSaved(res.images);
    setImageMessage(res.error ? { text: res.error, error: true } : { text: success });
    if (!res.error) router.refresh();
  }
  function runImage(work: () => Promise<ImageResult>, success: string, after?: () => void) {
    setImageMessage(null);
    startImageWork(async () => {
      try {
        const res = await work();
        applyImageResult(res, success);
        if (!res.error) after?.();
      } catch {
        setImageMessage({ text: "The connection was interrupted. Refresh to see the latest images.", error: true });
      }
    });
  }

  function addFiles(files: File[]) {
    if (!files.length) return;
    if (count + files.length > MAX_PRODUCT_IMAGES) {
      setImageMessage({ text: `A product can have up to ${MAX_PRODUCT_IMAGES} images. Remove one before adding more.`, error: true });
      return;
    }
    if (!editing) {
      const next = files.map((file, i) => {
        const url = URL.createObjectURL(file);
        objectUrls.current.push(url);
        return { key: crypto.randomUUID(), file, url, alt: defaultAlt(name, staged.length + i), altEdited: false, prep: NO_PREP };
      });
      setStaged([...staged, ...next]);
      setDirty(true);
      setImageMessage({ text: `${files.length} image${files.length > 1 ? "s" : ""} added. They upload when you save the product.` });
      return;
    }
    runImage(async () => {
      let last: ImageResult = {};
      for (const [i, file] of files.entries()) {
        const upload = new FormData();
        upload.set("product", product.id!);
        upload.set("file", file);
        upload.set("alt", defaultAlt(name, saved.length + i));
        upload.set("options", JSON.stringify(NO_PREP));
        last = await addProductImage(upload);
        if (last.images) setSaved(last.images);
        if (last.error) return last;
      }
      return last;
    }, files.length > 1 ? `${files.length} images added.` : "Image added.");
  }

  function move(index: number, to: number) {
    if (to < 0 || to >= count) return;
    if (!editing) {
      const next = [...staged];
      const [item] = next.splice(index, 1);
      next.splice(to, 0, item);
      setStaged(next);
      setDirty(true);
      setImageMessage({ text: to === 0 ? "Primary image changed." : `Image moved to position ${to + 1}.` });
      return;
    }
    const ids = saved.map((s) => s.id);
    const [item] = ids.splice(index, 1);
    ids.splice(to, 0, item);
    runImage(() => reorderProductImages(product.id!, ids), to === 0 ? "Primary image changed." : `Image moved to position ${to + 1}.`);
  }

  function remove(index: number) {
    if (!editing) {
      const item = staged[index];
      setStaged(staged.filter((s) => s.key !== item.key));
      if (selected === item.key) setSelected(null);
      setDirty(true);
      setImageMessage({ text: "Image removed." });
      return;
    }
    const item = saved[index];
    if (!window.confirm("Remove this image from the product? Its stored original is deleted too.")) return;
    runImage(() => removeProductImage(item.id), "Image removed.", () => selected === item.id && setSelected(null));
  }

  function replace(index: number, file: File) {
    if (!editing) {
      const url = URL.createObjectURL(file);
      objectUrls.current.push(url);
      setStaged(staged.map((s, i) => (i === index ? { ...s, file, url, prep: NO_PREP } : s)));
      setDirty(true);
      setImageMessage({ text: "Image replaced." });
      return;
    }
    const item = saved[index];
    const upload = new FormData();
    upload.set("image", item.id);
    upload.set("alt", item.alt);
    upload.set("file", file);
    upload.set("options", JSON.stringify(NO_PREP));
    runImage(() => updateProductImage(upload), "Image replaced. The new original is kept.");
  }

  function applyPrep(index: number, prep: Prep) {
    if (!editing) {
      setStaged(staged.map((s, i) => (i === index ? { ...s, prep } : s)));
      setDirty(true);
      setSelected(null);
      setImageMessage({ text: "Image settings updated. They apply when you save the product." });
      return;
    }
    const item = saved[index];
    const upload = new FormData();
    upload.set("image", item.id);
    upload.set("alt", item.alt);
    upload.set("options", JSON.stringify(prep));
    runImage(
      () => updateProductImage(upload),
      prep.backgroundRemoval === "remove-bg" ? "Image saved with the background removed." : "Image saved.",
      () => setSelected(null),
    );
  }

  function saveAlt(index: number, value: string) {
    if (!editing) {
      setStaged(staged.map((s, i) => (i === index ? { ...s, alt: value, altEdited: true } : s)));
      setDirty(true);
      return;
    }
    const item = saved[index];
    if (value.trim() === item.alt) return;
    runImage(() => updateImageAlt(item.id, value), "Image description saved.");
  }

  type Row = { key: string; thumb: string; src: string; alt: string; prep: Prep; label: string; size?: string };
  const rows: Row[] = editing
    ? saved.map((s) => ({ key: s.id, thumb: s.url, src: s.originalUrl, alt: s.alt, prep: s.preparation, label: s.alt, size: s.width && s.height ? `${s.width} × ${s.height} px` : undefined }))
    : staged.map((s, i) => ({ key: s.key, thumb: s.url, src: s.url, alt: s.altEdited ? s.alt : defaultAlt(name, i), prep: s.prep, label: s.file.name }));
  const selectedIndex = rows.findIndex((r) => r.key === selected);

  async function confirmDelete() {
    setDeleteState({ busy: true });
    try {
      const res = await deleteProduct(product.id!);
      if (res.blocked) {
        deleteDialog.current?.close();
        setDeleteState({ blocked: res.blocked });
        return;
      }
      if (res.error) {
        setDeleteState({ error: res.error });
        return;
      }
      deleteDialog.current?.close();
      setDirty(false);
      dialog.current?.close();
      router.push(hrefWith(listHref, { deleted: res.cleanupWarning ? "files" : "1" }), { scroll: false });
    } catch {
      setDeleteState({ error: "The connection was interrupted. Refresh to check whether the product still exists." });
    }
  }

  async function archiveInstead() {
    setDeleteState((s) => ({ ...s, busy: true }));
    const res = await setProductStatus(product.id!, "archived");
    if (res.error) {
      setDeleteState((s) => ({ ...s, busy: false, error: res.error }));
      return;
    }
    setStatus("archived");
    setDeleteState({});
    setNotice("Product archived. It is hidden from the store and its history is kept.");
    router.refresh();
  }

  const submitLabel = editing ? "Save changes" : status === "active" ? "Create and publish" : status === "archived" ? "Create as archived" : "Create draft";

  return (
    <dialog
      ref={dialog}
      className="product-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header className="product-dialog-header">
        <div>
          <p className="eyebrow">{editing ? "EDIT PRODUCT" : "NEW PRODUCT"}</p>
          <h2 id={titleId}>{editing ? product.name || "Untitled product" : "Add product"}</h2>
        </div>
        <button type="button" className="product-dialog-close" aria-label="Close product editor" onClick={close}>
          ×
        </button>
      </header>

      <div className="product-dialog-body">
        <div aria-live="polite" className="sr-only-live">
          {notice && (
            <p role="status" className="operations-notice">
              {notice}
            </p>
          )}
        </div>
        {result.error && (
          <p role="alert" className="form-error form-alert">
            {result.error}
          </p>
        )}
        {result.errors && !result.error && (
          <p role="alert" className="form-error form-alert">
            Check the highlighted fields. Your entries{editing ? "" : " and images"} are kept.
          </p>
        )}

        <form ref={formRef} id={`${titleId}-form`} className="product-form" onSubmit={submit}
          // Only named product fields count; image controls track their own changes.
          onChange={(e) => (e.target as unknown as { name?: string }).name && setDirty(true)}
        >
          <fieldset disabled={saving} className="product-form-fieldset">
            <section className="product-section" aria-labelledby={`${titleId}-basics`}>
              <h3 id={`${titleId}-basics`}>Basics</h3>
              <div className="field-grid">
                {field(
                  "name",
                  "Product name",
                  (p) => (
                    <input
                      {...p}
                      name="name"
                      value={name}
                      required
                      maxLength={200}
                      autoComplete="off"
                      onChange={(e) => {
                        setName(e.target.value);
                        if (!editing) autofill(e.target.value, checkedCategories());
                      }}
                    />
                  ),
                  { className: "span-2" },
                )}
                {field("sku", "SKU", (p) => <input {...p} name="sku" defaultValue={product.sku} required maxLength={200} autoComplete="off" />)}
                {field(
                  "slug",
                  "URL slug",
                  (p) => (
                    <input
                      {...p}
                      name="slug"
                      value={slug}
                      required
                      maxLength={150}
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      onChange={(e) => {
                        touched.current.add("slug");
                        setSlug(e.target.value);
                      }}
                    />
                  ),
                  { hint: `blendandbeam.com/products/${slug || "…"}` },
                )}
              </div>
              <fieldset className="status-choice">
                <legend>Status</legend>
                {(Object.keys(STATUS_COPY) as ProductStatus[]).map((s) => (
                  <label key={s} className={status === s ? "is-selected" : undefined}>
                    <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} />
                    <span>
                      <strong>{STATUS_COPY[s].label}</strong>
                      <small>{STATUS_COPY[s].help}</small>
                    </span>
                  </label>
                ))}
                {groupError("status")}
              </fieldset>
            </section>

            <section className="product-section" aria-labelledby={`${titleId}-pricing`}>
              <h3 id={`${titleId}-pricing`}>Pricing (GHS)</h3>
              <div className="field-grid three">
                {field("price_minor", "Price", (p) => <input {...p} name="price_minor" defaultValue={product.price} inputMode="decimal" required placeholder="0.00" />)}
                {field("compare_at_minor", "Compare-at price", (p) => <input {...p} name="compare_at_minor" defaultValue={product.compareAt} inputMode="decimal" placeholder="Optional" />, {
                  hint: "Shown struck through when higher than the price.",
                })}
                {field("cost_minor", "Cost (staff only)", (p) => <input {...p} name="cost_minor" defaultValue={product.cost} inputMode="decimal" placeholder="Optional" />, {
                  hint: "Never shown to customers; used for profit reports.",
                })}
              </div>
            </section>

            <section className="product-section" aria-labelledby={`${titleId}-catalog`}>
              <h3 id={`${titleId}-catalog`}>Category and brand</h3>
              <div className="field-grid">
                <fieldset className="checkbox-fieldset span-2">
                  <legend>Categories</legend>
                  {categories.length ? (
                    <div className="checkbox-grid">
                      {categories.map((c) => (
                        <label key={c.id} className="checkbox-item">
                          <input
                            type="checkbox"
                            name="categories"
                            value={c.id}
                            defaultChecked={product.categories.includes(c.id)}
                            onChange={() => !editing && autofill(name, checkedCategories())}
                          />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="field-hint">
                      No categories yet. <Link href="/admin/categories">Create categories</Link>.
                    </p>
                  )}
                  <small className="field-hint">The first selected category is shown on the product card.</small>
                  {groupError("categories")}
                </fieldset>
                {field(
                  "brand_id",
                  "Brand",
                  (p) => (
                    <select {...p} name="brand_id" defaultValue={product.brand_id}>
                      <option value="">No brand</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  ),
                  {
                    hint: brands.length ? undefined : (
                      <>
                        <Link href="/admin/brands">Add brands</Link> to choose one here.
                      </>
                    ),
                  },
                )}
                <fieldset className="checkbox-fieldset">
                  <legend>Merchandising</legend>
                  <label className="checkbox-item">
                    <input type="checkbox" name="is_featured" defaultChecked={product.is_featured} />
                    Featured on homepage
                  </label>
                  <label className="checkbox-item">
                    <input type="checkbox" name="is_best_seller" defaultChecked={product.is_best_seller} />
                    Best seller badge
                  </label>
                  <label className="checkbox-item">
                    <input type="checkbox" name="track_inventory" defaultChecked={product.track_inventory} />
                    Track stock
                  </label>
                </fieldset>
              </div>
            </section>

            <section className="product-section" aria-labelledby={`${titleId}-images`}>
              <h3 id={`${titleId}-images`}>Images</h3>
              <p className="field-hint">
                Up to {MAX_PRODUCT_IMAGES} JPEG, PNG or WebP images, 4 MB each. The first image is the primary image. Images keep their natural
                shape and transparency; originals are always kept.
                {editing ? " Image changes save immediately." : " Images upload when you create the product."}
              </p>
              <div aria-live="polite">
                {imageMessage && (
                  <p role={imageMessage.error ? "alert" : "status"} className={imageMessage.error ? "form-error" : "image-message"}>
                    {imageMessage.text}
                  </p>
                )}
              </div>
              {rows.length > 0 ? (
                <ol className="image-list" aria-busy={imageBusy}>
                  {rows.map((row, i) => (
                    <li key={row.key} className={`image-card${selected === row.key ? " is-selected" : ""}`}>
                      <div className="image-card-thumb checkerboard">
                        <img src={row.thumb} alt="" />
                        {i === 0 && <span className="image-badge">Primary</span>}
                      </div>
                      <div className="image-card-body">
                        <p className="image-card-title">
                          {i === 0 ? "Primary image" : `Image ${i + 1}`}
                          {row.size && <small> · {row.size}</small>}
                          {row.prep.backgroundRemoval === "remove-bg" && <small> · background removed</small>}
                          {row.prep.crop && <small> · cropped</small>}
                          {row.prep.rotation ? <small> · rotated {row.prep.rotation}°</small> : null}
                        </p>
                        <label>
                          Description (alt text)
                          {editing ? (
                            <input
                              key={`${row.key}-${row.alt}`}
                              defaultValue={row.alt}
                              minLength={3}
                              maxLength={200}
                              disabled={imageBusy}
                              onBlur={(e) => saveAlt(i, e.target.value)}
                            />
                          ) : (
                            <input value={row.alt} minLength={3} maxLength={200} onChange={(e) => saveAlt(i, e.target.value)} />
                          )}
                        </label>
                        <div className="image-card-actions">
                          <button type="button" className="button-quiet" disabled={i === 0 || imageBusy} onClick={() => move(i, 0)}>
                            Make primary
                          </button>
                          <button type="button" className="button-quiet" disabled={i === 0 || imageBusy} onClick={() => move(i, i - 1)} aria-label={`Move image ${i + 1} earlier`}>
                            ↑ Earlier
                          </button>
                          <button type="button" className="button-quiet" disabled={i === rows.length - 1 || imageBusy} onClick={() => move(i, i + 1)} aria-label={`Move image ${i + 1} later`}>
                            ↓ Later
                          </button>
                          <button type="button" className="button-quiet" disabled={imageBusy} aria-expanded={selected === row.key} onClick={() => setSelected(selected === row.key ? null : row.key)}>
                            Rotate / crop
                          </button>
                          <label className="button-quiet file-button">
                            Replace
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="sr-only"
                              disabled={imageBusy}
                              aria-label={`Replace image ${i + 1}`}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) replace(i, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <button type="button" className="button-quiet danger" disabled={imageBusy} onClick={() => remove(i)} aria-label={`Remove image ${i + 1}`}>
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="empty-inline">No images yet. Products with a clear primary image sell better.</p>
              )}
              {selectedIndex >= 0 && (
                <ImageWorkbench
                  key={`${rows[selectedIndex].key}-${rows[selectedIndex].src}`}
                  src={rows[selectedIndex].src}
                  alt={rows[selectedIndex].alt}
                  storeTone={presentationProducts.find((item) => item.slug === product.slug)?.tone ?? "rose"}
                  initial={rows[selectedIndex].prep}
                  backgroundRemovalAvailable={backgroundRemovalAvailable}
                  saved={editing}
                  busy={imageBusy}
                  onApply={(prep) => applyPrep(selectedIndex, prep)}
                  onCancel={() => setSelected(null)}
                  onRestore={editing ? () => applyPrep(selectedIndex, NO_PREP) : undefined}
                />
              )}
              {count < MAX_PRODUCT_IMAGES && (
                <label className="image-drop">
                  <span>
                    <strong>{imageBusy ? "Working on images…" : "Add images"}</strong>
                    <small>Choose one or more files · {MAX_PRODUCT_IMAGES - count} remaining</small>
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    disabled={imageBusy}
                    onChange={(e) => {
                      addFiles(Array.from(e.target.files ?? []));
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </section>

            <section className="product-section" aria-labelledby={`${titleId}-description`}>
              <h3 id={`${titleId}-description`}>Description</h3>
              {field("description", "Product description", (p) => <textarea {...p} name="description" defaultValue={product.description} rows={6} maxLength={10000} />, {
                hint: "Only include specifications and claims you can verify.",
              })}
              {field("warranty", "Warranty", (p) => <input {...p} name="warranty" defaultValue={product.warranty} maxLength={500} placeholder="Optional, e.g. 12-month manufacturer warranty" />)}
              <details className="seo-details" open={Boolean(result.errors?.seo_title || result.errors?.seo_description)}>
                <summary>Search listing (SEO)</summary>
                {field(
                  "seo_title",
                  "SEO title",
                  (p) => (
                    <input
                      {...p}
                      name="seo_title"
                      value={seoTitle}
                      maxLength={60}
                      onChange={(e) => {
                        touched.current.add("seo_title");
                        setSeoTitle(e.target.value);
                      }}
                    />
                  ),
                  { hint: `${seoTitle.length}/60 characters` },
                )}
                {field(
                  "seo_description",
                  "SEO description",
                  (p) => (
                    <textarea
                      {...p}
                      name="seo_description"
                      value={seoDescription}
                      maxLength={160}
                      rows={3}
                      onChange={(e) => {
                        touched.current.add("seo_description");
                        setSeoDescription(e.target.value);
                      }}
                    />
                  ),
                  { hint: `${seoDescription.length}/160 characters` },
                )}
              </details>
            </section>
          </fieldset>
        </form>

        {editing && (
          <>
            <section className="product-section" aria-labelledby={`${titleId}-variants`}>
              <h3 id={`${titleId}-variants`}>Variants</h3>
              <p className="field-hint">Variants (sizes, colours, finishes) belong to this product and each have their own SKU and price.</p>
              {variants.length ? (
                <div className="table-scroll">
                  <table className="admin-table compact">
                    <thead>
                      <tr>
                        <th scope="col">Variant</th>
                        <th scope="col">SKU</th>
                        <th scope="col">Price</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <Link href={`/admin/variants?product=${product.id}&edit=${v.id}`}>{v.name}</Link>
                          </td>
                          <td>{v.sku}</td>
                          <td>{v.price_minor == null ? "Product price" : money(v.price_minor)}</td>
                          <td>
                            <span className={`pill pill-${v.status}`}>{v.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-inline">No variants. Customers buy this product as a single item.</p>
              )}
              <Link className="text-link" href={`/admin/variants?product=${product.id}`}>
                {variants.length ? "Manage variants for this product →" : "Add a variant →"}
              </Link>
            </section>

            <section className="product-section" aria-labelledby={`${titleId}-stock`}>
              <h3 id={`${titleId}-stock`}>Stock</h3>
              {product.track_inventory ? (
                <p>
                  {stock
                    ? `${stock.quantity} in stock${stock.quantity <= 0 ? " — out of stock" : stock.quantity <= stock.low ? " — low stock" : ""}.`
                    : "No stock recorded yet, so customers can't order it."}{" "}
                  <Link className="text-link" href="/admin/inventory">
                    Adjust stock in Inventory →
                  </Link>
                </p>
              ) : (
                <p>Stock isn&apos;t tracked for this product, so it can always be ordered.</p>
              )}
            </section>

            <section className="product-section danger-zone" aria-labelledby={`${titleId}-remove`}>
              <h3 id={`${titleId}-remove`}>Archive or delete</h3>
              <p>
                <strong>Archive</strong> hides the product from the store but keeps its orders, reviews and stock history; choose Archived under
                Status above. <strong>Delete</strong> permanently removes a product that has never been sold, carted, reviewed or stocked.
              </p>
              {deleteState.blocked && (
                <div role="alert" className="blocked-notice">
                  <p>
                    <strong>This product can&apos;t be deleted.</strong> {deleteState.blocked} Archive it instead so the store keeps an accurate
                    history.
                  </p>
                  {status !== "archived" && (
                    <button type="button" className="button button-dark" onClick={archiveInstead} disabled={deleteState.busy}>
                      {deleteState.busy ? "Archiving…" : "Archive product"}
                    </button>
                  )}
                  {deleteState.error && <p className="form-error">{deleteState.error}</p>}
                </div>
              )}
              <button
                type="button"
                className="button-quiet danger"
                onClick={() => {
                  setDeleteState({});
                  deleteDialog.current?.showModal();
                }}
              >
                Delete product…
              </button>
            </section>

            <dialog ref={deleteDialog} className="confirm-dialog" aria-labelledby={`${titleId}-confirm`} aria-describedby={`${titleId}-confirm-text`}>
              <h3 id={`${titleId}-confirm`}>Delete “{product.name}”?</h3>
              <div id={`${titleId}-confirm-text`}>
                <p>This permanently removes the product, its variants and all of its images. It can&apos;t be undone.</p>
                <p>
                  If the product appears in an order, a customer&apos;s cart, a review or stock history, it won&apos;t be deleted and you&apos;ll be
                  offered to archive it instead.
                </p>
              </div>
              {deleteState.error && !deleteState.blocked && (
                <p role="alert" className="form-error">
                  {deleteState.error}
                </p>
              )}
              <div className="action-row">
                <button type="button" className="button button-danger" onClick={confirmDelete} disabled={deleteState.busy}>
                  {deleteState.busy ? "Deleting…" : "Delete permanently"}
                </button>
                <button type="button" className="button-quiet" autoFocus onClick={() => deleteDialog.current?.close()} disabled={deleteState.busy}>
                  Keep product
                </button>
              </div>
            </dialog>
          </>
        )}
      </div>

      <footer className="product-dialog-footer">
        <span className="footer-status" aria-live="polite">
          {saving ? progress || "Saving…" : dirty ? "Unsaved changes" : editing ? "All changes saved" : ""}
        </span>
        <button type="button" className="button-quiet" onClick={close} disabled={saving}>
          {editing && !dirty ? "Close" : "Cancel"}
        </button>
        <button type="submit" form={`${titleId}-form`} className="button button-dark submit-button" disabled={saving}>
          {saving ? (
            <span className="submit-progress-inline">
              <span className="loading-spinner" aria-hidden="true" />
              {progress || "Saving…"}
            </span>
          ) : (
            submitLabel
          )}
        </button>
      </footer>
    </dialog>
  );
}
