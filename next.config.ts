import type {NextConfig} from "next";
const nextConfig:NextConfig={poweredByHeader:false,images:{remotePatterns:[{protocol:"https",hostname:"gyjfofawvervookxjvmm.supabase.co",pathname:"/storage/v1/object/public/products/**"}]},experimental:{serverActions:{bodySizeLimit:"5mb"}},
async headers(){return [{source:"/:path*",headers:[
{key:"X-Content-Type-Options",value:"nosniff"},{key:"X-Frame-Options",value:"DENY"},{key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
{key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=(), payment=()"},
{key:"Strict-Transport-Security",value:"max-age=31536000; includeSubDomains"},
{key:"Content-Security-Policy",value:"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://gyjfofawvervookxjvmm.supabase.co; font-src 'self'; connect-src 'self' https://gyjfofawvervookxjvmm.supabase.co; upgrade-insecure-requests"}
]},{source:"/admin/:path*",headers:[{key:"X-Robots-Tag",value:"noindex, nofollow"},{key:"Cache-Control",value:"private, no-store"}]},{source:"/account/:path*",headers:[{key:"X-Robots-Tag",value:"noindex, nofollow"},{key:"Cache-Control",value:"private, no-store"}]}];}};
export default nextConfig;
