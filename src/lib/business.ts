export const business = {email:"info@blendandbeam.com",phone:"+233 59 877 5671",tel:"tel:+233598775671",whatsapp:"https://wa.me/233598775671",url:"https://blendandbeam.com"} as const;
export function orderMessage(product:{name:string;slug:string;price:number}) {
 return `${product.name}\nReference: ${product.slug}\nPrice: GHS ${(product.price/100).toFixed(2)}\n${business.url}/products/${encodeURIComponent(product.slug)}\nI'd like to order this product. Please confirm availability and delivery.`;
}
