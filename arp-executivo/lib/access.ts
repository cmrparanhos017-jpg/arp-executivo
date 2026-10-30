import 'server-only';
import { cookies } from 'next/headers';
export type Identity = { email:string; role:'admin'|'viewer'; id:string };
export async function accessCall(body:Record<string,unknown>,token?:string) {
 const endpoint=process.env.ARP_CLOUD_ENDPOINT?.replace(/arp-dataset$/, 'arp-access');
 if(!endpoint||!process.env.ARP_CLOUD_TOKEN)throw new Error('Acesso não configurado.');
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-arp-token':process.env.ARP_CLOUD_TOKEN,...(token?{'x-user-token':token}:{})},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20000)});
 return {status:response.status,data:await response.json()};
}
export async function saveSession(session:{access_token:string;refresh_token:string;expires_in:number}) {
 const jar=await cookies();const options={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/'};
 jar.set('arp_access',session.access_token,{...options,maxAge:session.expires_in});
 jar.set('arp_refresh',session.refresh_token,{...options,maxAge:7*24*3600});
}
export async function clearSession(){const jar=await cookies();jar.delete('arp_access');jar.delete('arp_refresh');}
export async function currentIdentity():Promise<Identity|null> {
 const jar=await cookies();let token=jar.get('arp_access')?.value;
 if(token){const result=await accessCall({action:'session'},token);if(result.status===200)return result.data.user;}
 const refresh=jar.get('arp_refresh')?.value;
 if(refresh){const result=await accessCall({action:'refresh',refreshToken:refresh});if(result.status===200){await saveSession(result.data.session);return result.data.user;}}
 return null;
}
export function sameOrigin(request:Request){try{return new URL(request.headers.get('origin')??'').host===request.headers.get('host');}catch{return false;}}
