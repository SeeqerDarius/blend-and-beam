import type {Preparation} from "@/lib/image-preparation";

export type AdminProductImage={id:string;url:string;originalUrl:string;alt:string;width:number|null;height:number|null;preparation:Pick<Preparation,"rotation"|"crop"|"backgroundRemoval">};

export function productImageUrl(path:string){
 const base=(process.env.NEXT_PUBLIC_SUPABASE_URL??"").replace(/\/$/,"");
 return `${base}/storage/v1/object/public/products/${path.split("/").map(encodeURIComponent).join("/")}`;
}
