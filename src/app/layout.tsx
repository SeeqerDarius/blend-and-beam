import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";
const display=Cormorant_Garamond({variable:"--font-display",subsets:["latin"],weight:["500","600","700"]});
const sans=Manrope({variable:"--font-sans",subsets:["latin"]});
const base=process.env.NEXT_PUBLIC_APP_URL??"http://localhost:3000";
export const metadata:Metadata={metadataBase:new URL(base),title:{default:"Blend & Beam | Premium Salon Equipment Ghana",template:"%s | Blend & Beam"},description:"Shop premium salon chairs, professional tools and beauty equipment with delivery across Ghana.",openGraph:{type:"website",locale:"en_GH",siteName:"Blend & Beam",title:"Blend & Beam",description:"Premium salon equipment for exceptional spaces."}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className={`${display.variable} ${sans.variable}`}><body>{children}</body></html>}
