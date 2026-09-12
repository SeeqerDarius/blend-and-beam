import Link from "next/link";
import {StoreHeader} from "@/components/store-header";
export const metadata={title:"Access restricted",robots:{index:false,follow:false}};
export default function Denied(){return <><StoreHeader/><main className="auth-page"><section><p className="eyebrow">RESTRICTED ACCESS</p><h1>Staff access only.</h1><p>Creating a customer account does not grant administration access. A store owner must explicitly assign your staff role.</p><Link className="button button-dark" href="/account">Go to my account</Link></section></main></>}
