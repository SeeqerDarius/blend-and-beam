import {describe,it,expect,vi,beforeAll,beforeEach,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,within,cleanup} from '@testing-library/react';

const actions=vi.hoisted(()=>({
 addProductImage:vi.fn(),createProduct:vi.fn(),deleteProduct:vi.fn(),removeProductImage:vi.fn(),reorderProductImages:vi.fn(),
 setProductStatus:vi.fn(),stageProductImage:vi.fn(),updateImageAlt:vi.fn(),updateProduct:vi.fn(),updateProductImage:vi.fn(),
}));
const router=vi.hoisted(()=>({push:vi.fn(),replace:vi.fn(),refresh:vi.fn()}));
vi.mock('@/app/admin/product-actions',()=>actions);
vi.mock('next/navigation',()=>({useRouter:()=>router}));
vi.mock('next/link',()=>({default:({href,children,...rest}:{href:string;children:React.ReactNode})=><a href={href} {...rest}>{children}</a>}));
vi.mock('react-easy-crop',()=>({default:()=>null}));

import {ProductEditor,type ProductInitial} from './product-editor';

beforeAll(()=>{
 // jsdom has no modal dialog implementation.
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
});
beforeEach(()=>{Object.values(actions).forEach(a=>a.mockReset());Object.values(router).forEach(f=>f.mockReset())});
afterEach(cleanup);

const blank:ProductInitial={name:'',slug:'',sku:'',price:'',compareAt:'',cost:'',brand_id:'',categories:[],description:'',warranty:'',seo_title:'',seo_description:'',status:'draft',is_featured:false,is_best_seller:false,track_inventory:true};
const categories=[{id:'11111111-1111-4111-8111-111111111111',name:'Chairs'}];
const brands=[{id:'22222222-2222-4222-8222-222222222222',name:'Takara'}];
const img=(id:string,alt:string)=>({id,url:`https://x.test/${id}.webp`,originalUrl:`https://x.test/${id}-original.webp`,alt,width:800,height:600,preparation:{rotation:0,crop:null,backgroundRemoval:'keep' as const}});

describe('product editor popup',()=>{
 it('creates with labelled fields, category/brand choices and a status-aware action',()=>{
  render(<ProductEditor mode="create" product={blank} categories={categories} brands={brands} backgroundRemovalAvailable={false} listHref="/admin/products"/>);
  expect(screen.getByRole('heading',{name:'Add product'})).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Product name'),{target:{value:'Hydraulic Barber Chair'}});
  expect((screen.getByLabelText('URL slug') as HTMLInputElement).value).toBe('hydraulic-barber-chair');
  expect(screen.getByRole('checkbox',{name:'Chairs'})).toBeTruthy();
  expect(screen.getByRole('combobox',{name:'Brand'})).toBeTruthy();
  expect(screen.getByRole('button',{name:'Create draft'})).toBeTruthy();
  fireEvent.click(screen.getByRole('radio',{name:/Active/}));
  expect(screen.getByRole('button',{name:'Create and publish'})).toBeTruthy();
  expect(screen.queryByText(/Delete product/)).toBeNull();
 });

 it('shows server field errors next to the fields',async()=>{
  actions.createProduct.mockResolvedValue({errors:{sku:'This SKU may already be in use.'},error:'Another product already uses this SKU or URL slug.'});
  render(<ProductEditor mode="create" product={{...blank,name:'Chair',slug:'chair',sku:'SC-1',price:'10'}} categories={categories} brands={brands} backgroundRemovalAvailable={false} listHref="/admin/products"/>);
  fireEvent.submit(screen.getByRole('button',{name:'Create draft'}).closest('dialog')!.querySelector('form')!);
  await waitFor(()=>expect(screen.getByText('This SKU may already be in use.')).toBeTruthy());
  expect(screen.getByLabelText('SKU').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByRole('alert').textContent).toMatch(/already uses/);
 });

 it('makes another image primary without leaving the popup',async()=>{
  actions.reorderProductImages.mockResolvedValue({images:[img('b','Side view'),img('a','Front view')]});
  render(<ProductEditor mode="edit" product={{...blank,id:'33333333-3333-4333-8333-333333333333',name:'Chair'}} images={[img('a','Front view'),img('b','Side view')]} categories={categories} brands={brands} backgroundRemovalAvailable={false} listHref="/admin/products"/>);
  const second=screen.getAllByRole('listitem')[1];
  fireEvent.click(within(second).getByRole('button',{name:'Make primary'}));
  await waitFor(()=>expect(actions.reorderProductImages).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333',['b','a']));
  await waitFor(()=>expect(screen.getByText('Primary image changed.')).toBeTruthy());
  expect(within(screen.getAllByRole('listitem')[0]).getByDisplayValue('Side view')).toBeTruthy();
 });

 it('confirms deletion and offers archiving when history blocks it',async()=>{
  actions.deleteProduct.mockResolvedValue({blocked:'It appears in past orders.'});
  actions.setProductStatus.mockResolvedValue({});
  render(<ProductEditor mode="edit" product={{...blank,id:'33333333-3333-4333-8333-333333333333',name:'Chair',status:'active'}} categories={categories} brands={brands} backgroundRemovalAvailable={false} listHref="/admin/products"/>);
  fireEvent.click(screen.getByRole('button',{name:'Delete product…'}));
  expect(actions.deleteProduct).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Delete permanently'}));
  await waitFor(()=>expect(screen.getByText(/can.t be deleted/)).toBeTruthy());
  expect(screen.getByText(/past orders/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Archive product'}));
  await waitFor(()=>expect(actions.setProductStatus).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333','archived'));
  await waitFor(()=>expect(screen.getByText(/Product archived/)).toBeTruthy());
  expect((screen.getByRole('radio',{name:/Archived/}) as HTMLInputElement).checked).toBe(true);
 });
});
