import {StoreHeader} from '@/components/store-header';
import {CartClient} from '@/components/cart-client';
import {getCatalog} from '@/lib/catalog-data';
export default async function Cart(){const {products}=await getCatalog();return <><StoreHeader/><main className="page-intro cart-page"><p className="eyebrow">YOUR SELECTION</p><h1>Shopping bag</h1><CartClient products={products}/></main></>}
