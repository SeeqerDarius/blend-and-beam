"use client";
import { useState } from "react";
import Cropper from "react-easy-crop";
import { recropImage } from "@/app/admin/image-actions";
import { ImagePreview } from "@/components/image-preview";
export function ImageManager({
  id,
  url,
  alt,
}: {
  id: string;
  url: string;
  alt: string;
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [mode, setMode] = useState<"fit" | "fill">("fit");
  const [aspect, setAspect] = useState(0.75);
  const [crop, setCrop] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <details className="operations-card">
      <summary>Recrop {alt}</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setMessage("");
          try {
            const form = new FormData(e.currentTarget);
            form.set("image", id);
            form.set(
              "options",
              JSON.stringify({ rotation, mode, aspect, crop }),
            );
            const result = await recropImage(form);
            setMessage(result.error ?? "Image updated successfully.");
          } catch {
            setMessage("Image could not be saved. Please retry.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <div className="crop-preview">
            <Cropper
              image={url}
              crop={pan}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setPan}
              onZoomChange={setZoom}
              onCropComplete={(_, area) => setCrop(area)}
            />
          </div>
          <div className="operations-form">
            <label>
              Alt text
              <input
                name="alt"
                defaultValue={alt}
                minLength={3}
                maxLength={200}
                required
              />
            </label>
            <label>
              Presentation
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "fit" | "fill")}
              >
                <option value="fit">Fit entire product</option>
                <option value="fill">Fill frame</option>
              </select>
            </label>
            <label>
              Aspect ratio
              <select
                value={aspect}
                onChange={(e) => setAspect(Number(e.target.value))}
              >
                <option value={0.75}>Portrait 3:4</option>
                <option value={1}>Square</option>
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
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="action-row">
            <button
              type="button"
              onClick={() => setRotation((rotation + 90) % 360)}
            >
              Rotate 90°
            </button>
            <button
              type="button"
              onClick={() => {
                setRotation(0);
                setPan({ x: 0, y: 0 });
                setZoom(1);
                setMode("fit");
                setAspect(0.75);
              }}
            >
              Reset
            </button>
          </div>
          <div className="preview-pair">
            <figure>
              <ImagePreview
                url={url}
                rotation={rotation}
                mode={mode}
                crop={crop}
                aspect={aspect}
                alt={alt}
              />
              <figcaption>Prepared product image</figcaption>
            </figure>
          </div>
          <button className="button button-dark" disabled={busy}>
            {busy ? "Preparing image…" : "Save prepared image"}
          </button>
        </fieldset>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
