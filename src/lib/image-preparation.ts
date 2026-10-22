import sharp from "sharp";
import {z} from "zod";
// Prepared images keep the upload's own aspect ratio and alpha channel: they are
// only rotated, optionally cropped, and scaled down so the longest edge fits.
export const PREPARED_MAX_EDGE=1600;
const cropBox=z.object({x:z.number().int().min(0),y:z.number().int().min(0),width:z.number().int().min(1),height:z.number().int().min(1)});
// `mode`/`aspect` come from the earlier editor and are still stored on older rows:
// "fit" meant any saved crop was ignored, and the fixed aspect canvas is gone.
export const cropSchema=z.object({rotation:z.number().int().min(0).max(270).multipleOf(90).default(0),crop:cropBox.nullable().default(null),backgroundRemoval:z.enum(["remove-bg","keep"]).default("keep"),mode:z.enum(["fit","fill"]).optional(),aspect:z.number().optional()})
 .transform(v=>({rotation:v.rotation,crop:v.mode==="fit"?null:v.crop,backgroundRemoval:v.backgroundRemoval}));
export type Preparation=z.output<typeof cropSchema>;
// Uploads are capped at 4 MB; a retained original being re-prepared may be a
// little larger (lossless WebP), so callers re-preparing one raise the limit.
export async function prepareImage(bytes:Buffer,mime:string,options:unknown,cutout?:Buffer,{maxBytes=4*1024*1024}={}){
 if(!bytes.length||bytes.length>maxBytes)throw new Error("Choose an image under 4 MB.");
 const format=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?"jpeg":bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?"png":bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP"?"webp":null;
 if(!format||mime!==`image/${format}`)throw new Error("File signature and MIME type must match JPEG, PNG or WebP.");
 const meta=await sharp(bytes,{limitInputPixels:25000000,failOn:"warning"}).metadata();
 if(!meta.width||!meta.height||Math.min(meta.width,meta.height)<160||Math.max(meta.width,meta.height)>10000||(meta.pages??1)>1)throw new Error("Use a still image between 160 and 10,000 pixels, up to 25 megapixels.");
 const config=cropSchema.parse(options);
 // The retained original is upright and metadata-free; PNGs (usually graphics or
 // cutouts) are kept lossless so they can be re-prepared without degradation.
 const original=await sharp(bytes,{limitInputPixels:25000000,failOn:"warning"}).autoOrient().webp(format==="png"?{lossless:true}:{quality:90,alphaQuality:100}).toBuffer();
 const source=cutout?await alignCutout(cutout,original):original;
 let pipeline=sharp(await sharp(source).rotate(config.rotation).toBuffer());
 if(config.crop){const m=await pipeline.metadata();if(config.crop.x+config.crop.width>m.width!||config.crop.y+config.crop.height>m.height!)throw new Error("Crop exceeds image bounds.");pipeline=pipeline.extract({left:config.crop.x,top:config.crop.y,width:config.crop.width,height:config.crop.height})}
 const prepared=await pipeline.resize({width:PREPARED_MAX_EDGE,height:PREPARED_MAX_EDGE,fit:"inside",withoutEnlargement:true}).webp({quality:86,alphaQuality:100}).toBuffer();
 const size=await sharp(prepared).metadata();return {original,prepared,width:size.width!,height:size.height!};
}
// The cutout replaces the source pixels; scale it to the original's upright size so crop coordinates chosen against the original still apply.
async function alignCutout(cutout:Buffer,original:Buffer){
 const o=await sharp(original).metadata();const c=await sharp(cutout,{limitInputPixels:25000000}).metadata();
 if(!c.width||!c.height||Math.abs(c.width/c.height-o.width!/o.height!)>.02*(o.width!/o.height!))throw new Error("The background-removal result does not match the uploaded image. Your original upload is unchanged.");
 return sharp(cutout,{limitInputPixels:25000000}).resize({width:o.width!,height:o.height!,fit:"fill"}).ensureAlpha().png().toBuffer();
}
