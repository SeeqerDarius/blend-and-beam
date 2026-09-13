import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {z} from "zod";
export async function POST(request:NextRequest){
 if(request.headers.get("origin")!==request.nextUrl.origin)return new NextResponse(null,{status:403});
 if(Number(request.headers.get("content-length")??0)>512)return new NextResponse(null,{status:413});
 const raw=await request.text();if(raw.length>512)return new NextResponse(null,{status:413});
 try{const value=z.object({slug:z.string().regex(/^[a-z0-9-]+$/).max(150),channel:z.enum(["call","whatsapp"])}).parse(JSON.parse(raw));const db=await createClient();await db.rpc("record_contact_selection",{p_slug:value.slug,p_channel:value.channel});return new NextResponse(null,{status:204})}catch{return new NextResponse(null,{status:400})}
}
