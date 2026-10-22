/* eslint-disable @next/next/no-img-element -- Previews are local canvas/object URLs, not optimizable remote images. */
"use client";
import { useEffect, useId, useState } from "react";
import Cropper from "react-easy-crop";

export type Crop = { x: number; y: number; width: number; height: number };
export type Prep = { rotation: number; crop: Crop | null; backgroundRemoval: "remove-bg" | "keep" };
export const NO_PREP: Prep = { rotation: 0, crop: null, backgroundRemoval: "keep" };
// Mirrors PREPARED_MAX_EDGE in lib/image-preparation (server-only module).
const MAX_EDGE = 1600;

type Rotated = { url: string; scale: number; width: number; height: number } | null;

// Draws the source upright at the chosen rotation, scaled for on-screen work.
// Crop coordinates are kept in full-resolution pixels of this rotated image,
// which is exactly what the server rotates and extracts.
function useRotated(src: string, rotation: number) {
  const [state, setState] = useState<{ key: string; value: Rotated; failed: boolean }>({ key: "", value: null, failed: false });
  const key = `${src}|${rotation}`;
  useEffect(() => {
    let active = true;
    const img = new window.Image();
    if (/^https?:/.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => {
      const sideways = rotation % 180 !== 0;
      const width = sideways ? img.naturalHeight : img.naturalWidth;
      const height = sideways ? img.naturalWidth : img.naturalHeight;
      const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, (-img.naturalWidth * scale) / 2, (-img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
      let url = "";
      try {
        url = canvas.toDataURL("image/webp", 0.92);
      } catch {
        // Cross-origin image without CORS: preview falls back to a CSS rotation.
      }
      if (active) setState({ key, value: url ? { url, scale, width, height } : null, failed: !url });
    };
    img.onerror = () => active && setState({ key, value: null, failed: true });
    img.src = src;
    return () => {
      active = false;
    };
  }, [src, rotation, key]);
  return state.key === key ? state : { key, value: null, failed: false };
}

function outputSize(width: number, height: number) {
  const s = Math.min(1, MAX_EDGE / Math.max(width, height));
  return { width: Math.round(width * s), height: Math.round(height * s) };
}

function useResultPreview(rotated: Rotated, crop: Crop | null) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!rotated) return;
    let active = true;
    const img = new window.Image();
    img.onload = () => {
      const region = crop
        ? { x: crop.x * rotated.scale, y: crop.y * rotated.scale, width: crop.width * rotated.scale, height: crop.height * rotated.scale }
        : { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(region.width));
      canvas.height = Math.max(1, Math.round(region.height));
      canvas.getContext("2d")!.drawImage(img, region.x, region.y, region.width, region.height, 0, 0, canvas.width, canvas.height);
      if (active) setPreview(canvas.toDataURL("image/webp", 0.92));
    };
    img.src = rotated.url;
    return () => {
      active = false;
    };
  }, [rotated, crop]);
  return rotated ? preview : "";
}

const ASPECTS = [
  { value: "original", label: "Original shape" },
  { value: "1", label: "Square 1:1" },
  { value: "0.75", label: "Portrait 3:4" },
  { value: "1.3333", label: "Landscape 4:3" },
];

export function ImageWorkbench({
  src,
  initial,
  alt,
  storeTone,
  backgroundRemovalAvailable,
  saved,
  busy,
  onApply,
  onCancel,
  onRestore,
}: {
  src: string;
  initial: Prep;
  alt: string;
  storeTone: string;
  backgroundRemovalAvailable: boolean;
  /** Saved images apply on the server; staged images apply on product save. */
  saved: boolean;
  busy?: boolean;
  onApply: (prep: Prep) => void;
  onCancel: () => void;
  onRestore?: () => void;
}) {
  const id = useId();
  const [rotation, setRotation] = useState(initial.rotation);
  const [crop, setCrop] = useState<Crop | null>(initial.crop);
  const [cropping, setCropping] = useState(Boolean(initial.crop));
  const [aspect, setAspect] = useState("original");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [removeBackground, setRemoveBackground] = useState(initial.backgroundRemoval === "remove-bg");
  const { value: rotated, failed } = useRotated(src, rotation);
  const preview = useResultPreview(rotated, cropping ? crop : null);
  const size = rotated ? (cropping && crop ? outputSize(crop.width, crop.height) : outputSize(rotated.width, rotated.height)) : null;
  const ratio = rotated ? (aspect === "original" ? rotated.width / rotated.height : Number(aspect)) : 1;

  function rotate(delta: number) {
    setRotation((r) => (r + delta + 360) % 360);
    // A crop belongs to one orientation; start a fresh one after rotating.
    setCrop(null);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }

  function apply() {
    onApply({ rotation, crop: cropping ? crop : null, backgroundRemoval: removeBackground ? "remove-bg" : "keep" });
  }

  return (
    <section className="image-workbench" aria-labelledby={`${id}-title`}>
      <h4 id={`${id}-title`}>Adjust image</h4>
      <p className="field-hint">
        Images keep their own shape and any transparency. Rotate if the photo is sideways; cropping is optional and only needed to trim
        unwanted edges. {saved ? "The original is kept, so you can restore it at any time." : "The original file is kept with the product."}
      </p>
      <div className="workbench-grid">
        <div>
          <div className="workbench-stage checkerboard">
            {cropping && rotated ? (
              <Cropper
                image={rotated.url}
                crop={pan}
                zoom={zoom}
                aspect={ratio}
                objectFit="contain"
                onCropChange={setPan}
                onZoomChange={setZoom}
                initialCroppedAreaPixels={
                  crop ? { x: crop.x * rotated.scale, y: crop.y * rotated.scale, width: crop.width * rotated.scale, height: crop.height * rotated.scale } : undefined
                }
                onCropComplete={(_, px) => {
                  const x = Math.max(0, Math.round(px.x / rotated.scale));
                  const y = Math.max(0, Math.round(px.y / rotated.scale));
                  setCrop({
                    x,
                    y,
                    width: Math.max(1, Math.min(rotated.width - x, Math.round(px.width / rotated.scale))),
                    height: Math.max(1, Math.min(rotated.height - y, Math.round(px.height / rotated.scale))),
                  });
                }}
              />
            ) : rotated ? (
              <img src={rotated.url} alt={alt} />
            ) : (
              <img src={src} alt={alt} style={{ transform: `rotate(${rotation}deg)` }} />
            )}
          </div>
          {cropping && rotated && (
            <p className="field-hint">Drag the image to position it, use the zoom slider, or focus the crop area and use the arrow keys.</p>
          )}
        </div>
        <div className="workbench-controls">
          <fieldset>
            <legend>Rotate</legend>
            <div className="action-row">
              <button type="button" className="button-quiet" onClick={() => rotate(-90)}>
                Rotate left
              </button>
              <button type="button" className="button-quiet" onClick={() => rotate(90)}>
                Rotate right
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend>Crop</legend>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={cropping}
                disabled={!rotated}
                onChange={(e) => {
                  setCropping(e.target.checked);
                  if (!e.target.checked) setCrop(null);
                }}
              />
              Crop this image
            </label>
            {failed && <small className="field-hint">Cropping isn&apos;t available for this image in your browser. Rotation still works.</small>}
            {cropping && rotated && (
              <>
                <label>
                  Crop shape
                  <select value={aspect} onChange={(e) => setAspect(e.target.value)}>
                    {ASPECTS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Zoom
                  <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
                </label>
              </>
            )}
          </fieldset>
          <fieldset>
            <legend>Background</legend>
            {backgroundRemovalAvailable ? (
              <label className="checkbox-item">
                <input type="checkbox" checked={removeBackground} onChange={(e) => setRemoveBackground(e.target.checked)} />
                Remove the background with remove.bg
              </label>
            ) : (
              <p className="field-hint">Automatic background removal isn&apos;t set up. The background is kept as uploaded.</p>
            )}
            {removeBackground && (
              <small className="field-hint">
                Sends this image to remove.bg when saved and uses one credit. The preview shows the original pixels; the cut-out appears after
                saving.
              </small>
            )}
          </fieldset>
        </div>
      </div>
      <div className="workbench-previews">
        <figure className="workbench-result">
          <div className="checkerboard">{preview ? <img src={preview} alt="" /> : <img src={src} alt="" style={{ transform: `rotate(${rotation}deg)` }} />}</div>
          <figcaption>
            Prepared image{size ? ` · ${size.width} × ${size.height} px` : ""}. The checkered area shows transparency.
          </figcaption>
        </figure>
        <figure className="workbench-store-preview">
          <figcaption>
            <strong>Storefront card preview</strong>
            <span>Check the product size against the same portrait card and background used on the shop.</span>
            <button type="button" className="button-quiet" onClick={() => { setCropping(true); setAspect("0.75"); }}>
              Adjust storefront framing
            </button>
          </figcaption>
          <div className={`workbench-store-card ${storeTone}`}>
            {preview ? <img src={preview} alt="" /> : <img src={src} alt="" style={{ transform: `rotate(${rotation}deg)` }} />}
          </div>
          <small>Product image · portrait card · transparent areas show the card background</small>
        </figure>
      </div>
      <div className="action-row">
        <button type="button" className="button button-dark" onClick={apply} disabled={busy || (cropping && !crop)}>
          {busy ? "Saving image…" : saved ? "Save image changes" : "Use these settings"}
        </button>
        {onRestore && (
          <button type="button" className="button-quiet" onClick={onRestore} disabled={busy}>
            Restore original
          </button>
        )}
        <button type="button" className="button-quiet" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </section>
  );
}
