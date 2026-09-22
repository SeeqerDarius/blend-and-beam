import "server-only";

export async function sendEmail({to,subject,html}:{to:string;subject:string;html:string}):Promise<{ok:true}|{ok:false;error:string}>{
 const key=process.env.RESEND_API_KEY;
 if(!key)return {ok:false,error:"RESEND_API_KEY is not configured"};
 const from=process.env.RESEND_FROM_EMAIL||"Blend & Beam <onboarding@resend.dev>";
 try{
  const res=await fetch("https://api.resend.com/emails",{
   method:"POST",
   headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
   body:JSON.stringify({from,to,subject,html}),
  });
  if(!res.ok){
   const body=await res.text().catch(()=>"");
   return {ok:false,error:`Resend responded ${res.status}: ${body.slice(0,300)}`};
  }
  return {ok:true};
 }catch(error){
  return {ok:false,error:error instanceof Error?error.message:"Network error contacting Resend"};
 }
}
