"use client";
import {business,orderMessage} from "@/lib/business";
import {money} from "@/lib/catalog";
export function CallToOrder({product}:{product:{name:string;slug:string;price:number}}){
 function track(channel:"call"|"whatsapp") { void fetch("/api/contact-events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({channel,slug:product.slug}),keepalive:true}).catch(()=>{}); }
 return <aside className="call-order" aria-label={`Call to order ${product.name}`}><h2>Prefer to talk it through?</h2><p>{product.name} · <strong>{money(product.price)}</strong></p><div className="action-row"><a className="button button-dark" href={business.tel} onClick={()=>track("call")}>Call to order</a><a className="button" href={`${business.whatsapp}?text=${encodeURIComponent(orderMessage(product))}`} onClick={()=>track("whatsapp")} target="_blank" rel="noopener noreferrer">WhatsApp <span className="sr-only">(opens a new tab)</span></a></div><small>{business.phone}</small></aside>;
}
