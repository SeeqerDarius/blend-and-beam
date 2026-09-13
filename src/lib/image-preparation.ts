import sharp from "sharp";
import {z} from "zod";
export const cropSchema=z.object({rotation:z.number().int().min(0).max(270).multipleOf(90),mode:z.enum(["fit","fill"]),aspect:z.number().min(.5).max(2),crop:z.object({x:z.number().int().min(0),y:z.number().int().min(0),width:z.number().int().min(1),height:z.number().int().min(1)}).nullable()});
export async function prepareImage(bytes:Buffer,mime:string,options:unknown){
 if(!bytes.length||bytes.length>4*1024*1024)throw new Error("Choose an image under 4 MB.");
 const format=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?"jpeg":bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?"png":bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP"?"webp":null;
 if(!format||mime!==`image/${format}`)throw new Error("File signature and MIME type must match JPEG, PNG or WebP.");
 const meta=await sharp(bytes,{limitInputPixels:25000000,failOn:"warning"}).metadata();
 if(!meta.width||!meta.height||Math.min(meta.width,meta.height)<160||Math.max(meta.width,meta.height)>10000||(meta.pages??1)>1)throw new Error("Use a still image between 160 and 10,000 pixels, up to 25 megapixels.");
 const config=cropSchema.parse(options);
 const original=await sharp(bytes,{limitInputPixels:25000000,failOn:"warning"}).autoOrient().webp({quality:90}).toBuffer();
 const rotated=await sharp(original).rotate(config.rotation).toBuffer();
 let pipeline=sharp(rotated);
 if(config.mode==="fill"&&config.crop){const m=await pipeline.metadata();if(config.crop.x+config.crop.width>m.width!||config.crop.y+config.crop.height>m.height!)throw new Error("Crop exceeds image bounds.");pipeline=pipeline.extract({left:config.crop.x,top:config.crop.y,width:config.crop.width,height:config.crop.height})}
 const prepared=await pipeline.resize({width:1200,height:Math.round(1200/config.aspect),fit:"contain",background:"#f6f2ea",withoutEnlargement:true}).webp({quality:84}).toBuffer();
 const size=await sharp(prepared).metadata();return {original,prepared,width:size.width!,height:size.height!};
}

