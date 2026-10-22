import {describe,it,expect} from 'vitest';
import {parseProductForm,deleteBlockReason,validImageOrder,searchTerm} from './product-form';

const category='11111111-1111-4111-8111-111111111111',brand='22222222-2222-4222-8222-222222222222';
function form(overrides:Record<string,string|string[]|undefined>={}){
 const base:Record<string,string|string[]|undefined>={name:' Salon chair ',slug:'salon-chair',sku:'SC-1',price_minor:'1,250.50',compare_at_minor:'',cost_minor:'',brand_id:brand,description:'Steel base',warranty:'',seo_title:'Salon chair',seo_description:'A chair',status:'draft',track_inventory:'on',categories:[category],...overrides};
 const f=new FormData();for(const [k,v] of Object.entries(base)){if(v===undefined)continue;for(const item of Array.isArray(v)?v:[v])f.append(k,item)}return f;
}

describe('product form parsing',()=>{
 it('converts GHS to exact pesewas and keeps blank optional amounts null',()=>{
  const r=parseProductForm(form());
  if('errors' in r)throw new Error(JSON.stringify(r.errors));
  expect(r.data).toMatchObject({name:'Salon chair',price_minor:125050,compare_at_minor:null,cost_minor:null,brand_id:brand,status:'draft',track_inventory:true,is_featured:false});
  expect(r.categories).toEqual([category]);
 });
 it('treats a blank brand as no brand',()=>{const r=parseProductForm(form({brand_id:''}));expect('data' in r&&r.data.brand_id).toBeNull()});
 it('reports field-level errors instead of guessing',()=>{
  const r=parseProductForm(form({price_minor:'12.345',slug:'Bad Slug',status:'deleted',categories:['not-a-uuid'],brand_id:'x'}));
  expect('errors' in r&&r.errors).toMatchObject({price_minor:expect.any(String),slug:expect.any(String),status:expect.any(String),categories:expect.any(String),brand_id:expect.any(String)});
 });
 it('requires a price and a compare-at price above it',()=>{
  expect('errors' in parseProductForm(form({price_minor:''}))&&true).toBe(true);
  const r=parseProductForm(form({price_minor:'100',compare_at_minor:'90'}));
  expect('errors' in r&&r.errors.compare_at_minor).toMatch(/higher/);
  const ok=parseProductForm(form({price_minor:'100',compare_at_minor:'120',cost_minor:'0'}));
  expect('data' in ok&&ok.data).toMatchObject({compare_at_minor:12000,cost_minor:0});
 });
});

describe('product lifecycle helpers',()=>{
 it('explains each guarded-delete refusal',()=>{
  expect(deleteBlockReason('Product is in order history; archive it instead')).toMatch(/orders/);
  expect(deleteBlockReason('Product is in a customer cart')).toMatch(/cart/);
  expect(deleteBlockReason('Product has customer reviews; archive it instead')).toMatch(/reviews/);
  expect(deleteBlockReason('Product has stock movement history; archive it instead')).toMatch(/stock/);
  expect(deleteBlockReason('Forbidden')).toBeNull();
 });
 it('accepts only a complete reordering of the same images',()=>{
  expect(validImageOrder(['a','b','c'],['c','a','b'])).toBe(true);
  expect(validImageOrder(['a','b','c'],['a','b'])).toBe(false);
  expect(validImageOrder(['a','b'],['a','a'])).toBe(false);
  expect(validImageOrder(['a','b'],['a','x'])).toBe(false);
 });
 it('strips filter-syntax characters from searches',()=>{
  expect(searchTerm('chair),status.eq.active')).toBe('chair status.eq.active');
  expect(searchTerm('  SC-1  ')).toBe('SC-1');
  expect(searchTerm('%_*')).toBe('_');
 });
});
