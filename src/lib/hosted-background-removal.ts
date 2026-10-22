import sharp from "sharp";

const REMOVE_BG_URL = "https://api.remove.bg/v1.0/removebg";

export function isBackgroundRemovalConfigured() {
  return Boolean(process.env.REMOVE_BG_API_KEY);
}

export async function removeImageBackground(
  bytes: Buffer,
  mime: string,
): Promise<Buffer> {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Background removal is not configured. Set REMOVE_BG_API_KEY in Vercel, or choose Keep original background.",
    );
  }

  // Send an upright JPEG/PNG so the cutout lines up with the auto-oriented
  // original. Retained originals are WebP, which is re-encoded here.
  const { orientation, hasAlpha } = await sharp(bytes, { limitInputPixels: 25_000_000 }).metadata();
  const needsReencode = (orientation && orientation > 1) || mime === "image/webp";
  const upright = needsReencode
    ? hasAlpha
      ? { bytes: await sharp(bytes, { limitInputPixels: 25_000_000 }).autoOrient().png().toBuffer(), mime: "image/png" }
      : { bytes: await sharp(bytes, { limitInputPixels: 25_000_000 }).autoOrient().jpeg({ quality: 95 }).toBuffer(), mime: "image/jpeg" }
    : { bytes, mime };

  const form = new FormData();
  form.set("image_file", new Blob([new Uint8Array(upright.bytes)], { type: upright.mime }), "product-image");
  form.set("size", "auto");

  let response: Response;
  try {
    response = await fetch(REMOVE_BG_URL, {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    throw new Error("Background removal could not be reached. Please retry or keep the original.");
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 402 || response.status === 429) {
      throw new Error("The background-removal service has no available credits. Keep the original or try again later.");
    }
    if (response.status === 403 || response.status === 401) {
      throw new Error("The background-removal service rejected its API key. Check REMOVE_BG_API_KEY in Vercel.");
    }
    throw new Error(
      detail.slice(0, 240) || `Background removal failed (${response.status}). Please retry or keep the original.`,
    );
  }

  const contentType = response.headers.get("content-type")?.split(";")[0];
  if (contentType !== "image/png") {
    throw new Error("Background removal returned an unsupported image. Your original upload is unchanged.");
  }
  const output = Buffer.from(await response.arrayBuffer());
  if (!output.length || output.length > 12 * 1024 * 1024) {
    throw new Error("The processed image is too large. Try a smaller source image.");
  }
  const metadata = await sharp(output, { limitInputPixels: 25_000_000 }).metadata();
  if (metadata.format !== "png" || !metadata.hasAlpha) {
    throw new Error("The background-removal service did not return a transparent cutout. Your original upload is unchanged.");
  }
  return output;
}

