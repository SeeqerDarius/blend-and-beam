/* eslint-disable @next/next/no-img-element -- Local image previews use object URLs and cannot use the server image optimizer. */
"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ImagePreview } from "@/components/image-preview";
import Cropper from "react-easy-crop";
import {
  createProduct,
  stageProductImage,
  type StagedImage,
  type ProductResult,
} from "@/app/admin/product-actions";
import { draftCopy } from "@/lib/product-draft";
type Crop = { x: number; y: number; width: number; height: number };
type Photo = {
  id: string;
  file: File;
  url: string;
  alt: string;
  rotation: number;
  mode: "fit" | "fill";
  aspect: number;
  crop: Crop | null;
  pan: { x: number; y: number };
  zoom: number;
};
export function ProductCreateForm({
  categories,
}: {
  categories: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [details, setDetails] = useState("");
  const [copy, setCopy] = useState(draftCopy("", "", ""));
  const manual = useRef(new Set<string>());
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const key = useRef("");
  const [result, setResult] = useState<ProductResult>({});
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);
  function generate(n: string, c: string, d: string, force = false) {
    const next = draftCopy(
      n,
      categories.find((x) => x.id === c)?.name ?? "",
      d,
    );
    setCopy(
      (prev) =>
        Object.fromEntries(
          Object.entries(next).map(([k, v]) => [
            k,
            !force && manual.current.has(k) ? prev[k as keyof typeof prev] : v,
          ]),
        ) as typeof next,
    );
  }
  function changePhoto(id: string, patch: Partial<Photo>) {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }
  const photo = photos.find((p) => p.id === selected);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setResult({});
    try {
      if (!key.current) key.current = crypto.randomUUID();
      const form = new FormData(e.currentTarget);
      form.set("key", key.current);
      const staged: StagedImage[] = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        setProgress(`Image ${i + 1} of ${photos.length}: ${p.file.name}`);
        const upload = new FormData();
        upload.set("key", key.current);
        upload.set("imageKey", p.id);
        upload.set("alt", p.alt);
        upload.set("file", p.file);
        upload.set(
          "options",
          JSON.stringify({
            rotation: p.rotation,
            mode: p.mode,
            aspect: p.aspect,
            crop: p.crop,
          }),
        );
        const result = await stageProductImage(upload);
        if (result.error) {
          setResult({ error: result.error });
          return;
        }
        if (result.id) {
          router.push(`/admin/products?edit=${result.id}&saved=1`);
          return;
        }
        if (result.image) staged.push({ ...result.image, sort_order: i });
      }
      form.set("preparation", JSON.stringify(staged));
      setProgress("Saving product…");
      const saved = await createProduct(form);
      setResult(saved);
      if (saved.id) router.push(`/admin/products?edit=${saved.id}&saved=1`);
    } catch {
      setResult({
        error:
          "Connection interrupted. Retry this form; your upload session is preserved.",
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const err = (field: string) =>
    result.errors?.[field] ? (
      <small className="form-error" id={`error-${field}`}>
        {result.errors[field]}
      </small>
    ) : null;
  return (
    <form
      onSubmit={submit}
      className="product-create operations-card"
      aria-busy={busy}
    >
      <fieldset disabled={busy}>
        <legend>Product details</legend>
        <div className="operations-form">
          <label>
            Product name
            <input
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                generate(e.target.value, category, details);
              }}
              required
              maxLength={200}
              aria-describedby="error-name"
            />
            {err("name")}
          </label>
          <label>
            Category
            <select
              name="category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                generate(name, e.target.value, details);
              }}
            >
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {err("category")}
          </label>
          <label>
            SKU
            <input
              name="sku"
              required
              maxLength={200}
              aria-describedby="error-sku"
            />
            {err("sku")}
          </label>
          <label>
            Price (GHS)
            <input
              name="price_minor"
              inputMode="decimal"
              required
              placeholder="0.00"
              aria-describedby="error-price_minor"
            />
            {err("price_minor")}
          </label>
          <label>
            Cost (GHS, staff only)
            <input
              name="cost_minor"
              inputMode="decimal"
              placeholder="Optional"
              aria-describedby="error-cost_minor"
            />
            {err("cost_minor")}
          </label>
        </div>
        <label>
          Known product details
          <textarea
            value={details}
            onChange={(e) => {
              setDetails(e.target.value);
              generate(name, category, e.target.value);
            }}
            maxLength={8000}
            rows={3}
            placeholder="Only add specifications or claims you can verify."
          />
        </label>
        <div className="operations-form">
          {Object.entries(copy).map(([field, value]) => (
            <label key={field}>
              {
                {
                  slug: "URL slug",
                  description: "Description",
                  seo_title: "SEO title",
                  seo_description: "SEO description",
                }[field as keyof typeof copy]
              }
              {field === "description" || field === "seo_description" ? (
                <textarea
                  name={field}
                  value={value}
                  onChange={(e) => {
                    manual.current.add(field);
                    setCopy({ ...copy, [field]: e.target.value });
                  }}
                  maxLength={field === "description" ? 10000 : 160}
                  rows={4}
                  aria-describedby={`error-${field}`}
                />
              ) : (
                <input
                  name={field}
                  value={value}
                  onChange={(e) => {
                    manual.current.add(field);
                    setCopy({ ...copy, [field]: e.target.value });
                  }}
                  required={field === "slug"}
                  maxLength={field === "slug" ? 150 : 60}
                  aria-describedby={`error-${field}`}
                />
              )}
              <small>
                {field.startsWith("seo")
                  ? `${value.length}/${field === "seo_title" ? 60 : 160}`
                  : "Editable before saving"}
              </small>
              {err(field)}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => generate(name, category, details, true)}
        >
          Regenerate copy from details
        </button>
        <fieldset className="segmented">
          <legend>Status</legend>
          {["draft", "active", "archived"].map((s) => (
            <label key={s}>
              <input
                type="radio"
                name="status"
                value={s}
                defaultChecked={s === "active"}
              />
              {s[0].toUpperCase() + s.slice(1)}
            </label>
          ))}
        </fieldset>
        <div className="action-row">
          {[
            ["is_featured", "Featured on homepage"],
            ["is_best_seller", "Best seller"],
            ["track_inventory", "Track inventory"],
          ].map(([key, label]) => (
            <label key={key}>
              <input type="checkbox" name={key} defaultChecked />
              {label}
            </label>
          ))}
        </div>
        <h2>Product images</h2>
        <p>
          Up to six JPEG, PNG or WebP images, 4 MB each. The first image is the
          primary image. Originals are retained without metadata for future
          preparation.
        </p>
        <label>
          Add images
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length + photos.length > 6) {
                setResult({ error: "Choose up to six images." });
                return;
              }
              const next = files.map((file) => {
                const url = URL.createObjectURL(file);
                urls.current.push(url);
                return {
                  id: crypto.randomUUID(),
                  file,
                  url,
                  alt: name,
                  rotation: 0,
                  mode: "fit" as const,
                  aspect: 0.75,
                  crop: null,
                  pan: { x: 0, y: 0 },
                  zoom: 1,
                };
              });
              setPhotos([...photos, ...next]);
              if (next[0]) setSelected(next[0].id);
              e.target.value = "";
            }}
          />
        </label>
        <div className="photo-list">
          {photos.map((p, i) => (
            <div className="photo-tile" key={p.id}>
              <button
                type="button"
                onClick={() => setSelected(p.id)}
                aria-pressed={selected === p.id}
              >
                {/* Local object URL, not an external image. */}
                <img
                  src={p.url}
                  alt={p.alt || p.file.name}
                  width={100}
                  height={120}
                />
                <span>{i === 0 ? "Primary image" : `Image ${i + 1}`}</span>
              </button>
              <small>{p.file.name}</small>
              <label>
                Alt text
                <input
                  value={p.alt}
                  onChange={(e) => changePhoto(p.id, { alt: e.target.value })}
                  required
                  minLength={3}
                  maxLength={200}
                />
              </label>
              <div className="action-row">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() =>
                    setPhotos([p, ...photos.filter((x) => x.id !== p.id)])
                  }
                >
                  Make primary
                </button>
                <button
                  type="button"
                  disabled={i === 0}
                  aria-label={`Move ${p.file.name} earlier`}
                  onClick={() => {
                    const next = [...photos];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    setPhotos(next);
                  }}
                >
                  Move earlier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhotos(photos.filter((x) => x.id !== p.id));
                    URL.revokeObjectURL(p.url);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        {photo && (
          <section className="image-preparation">
            <h3>Prepare {photo.file.name}</h3>
            <div className="crop-preview">
              {photo.mode === "fill" ? (
                <Cropper
                  image={photo.url}
                  crop={photo.pan}
                  zoom={photo.zoom}
                  rotation={photo.rotation}
                  aspect={photo.aspect}
                  onCropChange={(pan) => changePhoto(photo.id, { pan })}
                  onZoomChange={(zoom) => changePhoto(photo.id, { zoom })}
                  onCropComplete={(_, crop) => changePhoto(photo.id, { crop })}
                />
              ) : (
                <img
                  src={photo.url}
                  alt={photo.alt}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    transform: `rotate(${photo.rotation}deg)`,
                  }}
                />
              )}
            </div>
            <div className="operations-form">
              <label>
                Presentation
                <select
                  value={photo.mode}
                  onChange={(e) =>
                    changePhoto(photo.id, {
                      mode: e.target.value as "fit" | "fill",
                      zoom: 1,
                      pan: { x: 0, y: 0 },
                    })
                  }
                >
                  <option value="fit">Fit entire product</option>
                  <option value="fill">Fill frame</option>
                </select>
              </label>
              <label>
                Aspect ratio
                <select
                  value={photo.aspect}
                  onChange={(e) =>
                    changePhoto(photo.id, { aspect: Number(e.target.value) })
                  }
                >
                  <option value={0.75}>Portrait 3:4</option>
                  <option value={1}>Square 1:1</option>
                  <option value={1.5}>Landscape 3:2</option>
                </select>
              </label>
              <label>
                Zoom
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  disabled={photo.mode === "fit"}
                  value={photo.zoom}
                  onChange={(e) =>
                    changePhoto(photo.id, { zoom: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <div className="action-row">
              <button
                type="button"
                onClick={() =>
                  changePhoto(photo.id, {
                    rotation: (photo.rotation + 90) % 360,
                  })
                }
              >
                Rotate 90°
              </button>
              <button
                type="button"
                onClick={() =>
                  changePhoto(photo.id, {
                    rotation: 0,
                    pan: { x: 0, y: 0 },
                    zoom: 1,
                    aspect: 0.75,
                    mode: "fit",
                    crop: null,
                  })
                }
              >
                Reset
              </button>
            </div>
            <p>
              Drag to pan in Fill frame, or focus the crop area and use arrow
              keys. Fit entire product preserves the object with padding.
            </p>
            <div className="preview-pair">
              <figure>
                <ImagePreview
                  url={photo.url}
                  alt={photo.alt}
                  rotation={photo.rotation}
                  mode={photo.mode}
                  crop={photo.crop}
                  aspect={photo.aspect}
                />
                <figcaption>Storefront card · portrait fit</figcaption>
              </figure>
              <figure>
                <ImagePreview
                  url={photo.url}
                  alt={photo.alt}
                  rotation={photo.rotation}
                  mode={photo.mode}
                  crop={photo.crop}
                  aspect={photo.aspect}
                />
                <figcaption>Product detail · full image</figcaption>
              </figure>
            </div>
          </section>
        )}
      </fieldset>
      {result.error && (
        <p role="alert" className="form-error">
          {result.error}
        </p>
      )}
      {result.errors && (
        <p role="alert">
          Correct the highlighted fields. Your entries and images are retained.
        </p>
      )}
      <button
        className="button button-dark submit-button"
        type="submit"
        disabled={busy}
      >
        <span style={{ visibility: busy ? "hidden" : "visible" }}>
          Save product and images
        </span>
        {busy && (
          <span className="submit-progress" role="status">
            {progress || "Preparing and saving…"}
          </span>
        )}
      </button>
    </form>
  );
}
