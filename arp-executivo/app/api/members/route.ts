import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { accessCall,currentIdentity,sameOrigin } from '@/lib/access';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){try{const user=await currentIdentity();if(user?.role!=='admin')return NextResponse.json({error:'Acesso restrito.'},{status:403,headers});const result=await accessCall({action:'list'},(await cookies()).get('arp_access')?.value);return NextResponse.json(result.data,{status:result.status,headers});}catch{return NextResponse.json({error:'Falha ao consultar acessos.'},{status:500,headers});}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Origem inválida.'},{status:403});
 try{const user=await currentIdentity();if(user?.role!=='admin')return NextResponse.json({error:'Acesso restrito.'},{status:403,headers});
 const raw=await request.text();if(raw.length>2048)return NextResponse.json({error:'Solicitação grande demais.'},{status:413});
 const body=JSON.parse(raw);if(!['invite','revoke','reactivate'].includes(body.action))return NextResponse.json({error:'Operação inválida.'},{status:400});
 const result=await accessCall({action:body.action,email:body.email},(await cookies()).get('arp_access')?.value);
 if(result.status===200&&result.data.tokenHash)return NextResponse.json({link:`https://arp-executivo.vercel.app/#convite=${encodeURIComponent(result.data.tokenHash)}`},{headers});
 return NextResponse.json(result.data,{status:result.status,headers});
 }catch{return NextResponse.json({error:'Falha ao gerenciar acesso.'},{status:500,headers});}
}
