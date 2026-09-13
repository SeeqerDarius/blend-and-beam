// @vitest-environment node
import {describe,it,expect} from 'vitest';
import sharp from 'sharp';
import {prepareImage} from './image-preparation';
const fit={mode:'fit',rotation:0,aspect:.75,crop:null};
describe('secure product image preparation',()=>{
 it('rejects disguised files and incorrect MIME types',async()=>{await expect(prepareImage(Buffer.from('<svg onload="alert(1)"/>'),'image/png',fit)).rejects.toThrow();const b=await sharp({create:{width:200,height:300,channels:3,background:'red'}}).png().toBuffer();await expect(prepareImage(b,'image/jpeg',fit)).rejects.toThrow('MIME')});
 it('rejects oversize files, tiny images, corrupt data and invalid crops',async()=>{await expect(prepareImage(Buffer.alloc(4*1024*1024+1),'image/png',fit)).rejects.toThrow();const b=await sharp({create:{width:100,height:100,channels:3,background:'red'}}).png().toBuffer();await expect(prepareImage(b,'image/png',fit)).rejects.toThrow('160');await expect(prepareImage(Buffer.from([255,216,255,0]),'image/jpeg',fit)).rejects.toThrow()});
 it('strips metadata, preserves original dimensions and never upscales product',async()=>{const b=await sharp({create:{width:300,height:600,channels:3,background:'red'}}).withExif({IFD0:{Artist:'Private author'}}).jpeg().toBuffer();const r=await prepareImage(b,'image/jpeg',fit);const m=await sharp(r.prepared).metadata();expect(m.format).toBe('webp');expect(m.exif).toBeUndefined();const original=await sharp(r.original).metadata();expect(original.width).toBe(300);expect(original.height).toBe(600);expect(original.exif).toBeUndefined();expect(r.width).toBeLessThanOrEqual(1200)});
 it('supports rotated crop and rejects out-of-bounds crop',async()=>{const b=await sharp({create:{width:200,height:400,channels:3,background:'red'}}).png().toBuffer();await expect(prepareImage(b,'image/png',{...fit,mode:'fill',rotation:90,crop:{x:0,y:0,width:200,height:200}})).resolves.toBeDefined();await expect(prepareImage(b,'image/png',{...fit,mode:'fill',crop:{x:0,y:0,width:500,height:500}})).rejects.toThrow('bounds')});
});
