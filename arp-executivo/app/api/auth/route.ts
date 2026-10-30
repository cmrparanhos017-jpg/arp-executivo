import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { accessCall,clearSession,currentIdentity,sameOrigin,saveSession } from '@/lib/access';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){try{const user=await currentIdentity();return NextResponse.json({user},{status:user?200:401,headers});}catch{return NextResponse.json({error:'Acesso temporariamente indisponível.'},{status:503,headers});}}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Origem inválida.'},{status:403});
 try{
 const raw=await request.text();if(raw.length>4096)return NextResponse.json({error:'Solicitação grande demais.'},{status:413});
 const body=JSON.parse(raw);
 if(body.action==='logout'){const token=(await cookies()).get('arp_access')?.value;try{if(token)await accessCall({action:'logout'},token);}finally{await clearSession();}return NextResponse.json({ok:true},{headers});}
 if(body.action==='selfRecovery'){const user=await currentIdentity();if(user?.role!=='admin')return NextResponse.json({error:'Acesso restrito.'},{status:403});const result=await accessCall({action:'selfRecovery'},(await cookies()).get('arp_access')?.value);if(result.status!==200)return NextResponse.json({error:'Não foi possível gerar o link.'},{status:result.status});return NextResponse.json({link:`https://arp-executivo.vercel.app/#convite=${encodeURIComponent(result.data.tokenHash)}&tipo=recovery`},{headers});}
 if(!['login','accept'].includes(body.action))return NextResponse.json({error:'Operação inválida.'},{status:400});
 const result=await accessCall(body);
 if(result.status!==200)return NextResponse.json({error:result.data.error},{status:result.status,headers});
 await saveSession(result.data.session);return NextResponse.json({user:result.data.user},{headers});
 }catch{return NextResponse.json({error:'Não foi possível entrar. Tente novamente.'},{status:500,headers});}
}
