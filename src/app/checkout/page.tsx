import {StoreHeader} from '@/components/store-header';
import {CheckoutForm} from '@/components/checkout-form';
import {createClient} from '@/lib/supabase/server';
import Link from 'next/link';
export default async function Checkout(){const db=await createClient();const {data:{user}}=await db.auth.getUser();const {data:zones,error}=await db.from('shipping_zones').select('id,name,regions,fee_minor,free_shipping_threshold_minor').eq('is_active',true).eq('cod_enabled',true);if(error)throw new Error('Delivery options could not be loaded. Please retry.');return <><StoreHeader/><main className="auth-page checkout"><section><p className="eyebrow">CHECKOUT</p><h1>Your delivery</h1>{user?<CheckoutForm zones={zones??[]}/>:<p><Link className="button button-dark" href="/login?next=/checkout">Sign in to place your order</Link></p>}</section></main></>}
