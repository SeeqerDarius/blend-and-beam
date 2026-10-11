import sharp from "sharp";
import {z} from "zod";
export const cropSchema=z.object({rotation:z.number().int().min(0).max(270).multipleOf(90),mode:z.enum(["fit","fill"]),aspect:z.number().min(.5).max(2),crop:z.object({x:z.number().int().min(0),y:z.number().int().min(0),width:z.number().int().min(1),height:z.number().int().min(1)}).nullable(),backgroundRemoval:z.enum(["remove-bg","keep"]).default("keep")});
export async function prepareImage(bytes:Buffer,mime:string,options:unknown,cutout?:Buffer){
 if(!bytes.length||bytes.length>4*1024*1024)throw new Error("Choose an image under 4 MB.");
 const format=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?"jpeg":bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?"png":bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP"?"webp":null;
 if(!format||mime!==`image/${format}`)throw new Error("File signature and MIME type must match JPEG, PNG or WebP.");
 const meta=await sharp(bytes,{limitInputPixels:25000000,failOn:"warning"}).metadata();
 if(!meta.width||!meta.height||Math.min(meta.width,meta.height)<160||Math.max(meta.width,meta.height)>10000||(meta.pages??1)>1)throw new Error("Use a still image between 160 and 10,000 pixels, up to 25 megapixels.");
 const config=cropSchema.parse(options);
 const original=await sharp(bytes,{limitInputPixels:25000000,failOn:"warning"}).autoOrient().webp({quality:90}).toBuffer();
 const source=cutout?await alignCutout(cutout,original):original;
 const rotated=await sharp(source).rotate(config.rotation).toBuffer();
 let pipeline=sharp(rotated);
 if(config.mode==="fill"&&config.crop){const m=await pipeline.metadata();if(config.crop.x+config.crop.width>m.width!||config.crop.y+config.crop.height>m.height!)throw new Error("Crop exceeds image bounds.");pipeline=pipeline.extract({left:config.crop.x,top:config.crop.y,width:config.crop.width,height:config.crop.height})}
 if(cutout){const flat=await pipeline.png().toBuffer();pipeline=sharp(await sharp(flat).trim({background:{r:0,g:0,b:0,alpha:0},threshold:8}).toBuffer().catch(()=>flat))}
 const prepared=await pipeline.resize({width:1200,height:Math.round(1200/config.aspect),fit:"contain",background:cutout?{r:0,g:0,b:0,alpha:0}:"#f6f2ea",withoutEnlargement:true}).webp({quality:84}).toBuffer();
 const size=await sharp(prepared).metadata();return {original,prepared,width:size.width!,height:size.height!};
}
// The cutout replaces the source pixels; scale it to the original's upright size so crop coordinates chosen against the original still apply.
async function alignCutout(cutout:Buffer,original:Buffer){
 const o=await sharp(original).metadata();const c=await sharp(cutout,{limitInputPixels:25000000}).metadata();
 if(!c.width||!c.height||Math.abs(c.width/c.height-o.width!/o.height!)>.02*(o.width!/o.height!))throw new Error("The background-removal result does not match the uploaded image. Your original upload is unchanged.");
 return sharp(cutout,{limitInputPixels:25000000}).resize({width:o.width!,height:o.height!,fit:"fill"}).ensureAlpha().png().toBuffer();
}

