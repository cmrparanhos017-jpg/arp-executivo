import { NextResponse } from 'next/server';
import { currentIdentity } from '@/lib/access';
import { confirmedCatalog, pncpReference } from '@/lib/purchases';
export async function GET(request:Request){
 try{
 if(!await currentIdentity())return NextResponse.json({error:'Entre para continuar.'},{status:401});
 const q=new URL(request.url).searchParams, ref=pncpReference(q.get('link')??'');
 if(!ref||ref.year!==q.get('year')||!/^\d{6}$/.test(q.get('ugg')??'')||!/^\d{1,6}$/.test(q.get('number')??''))return NextResponse.json({error:'Referência PNCP inválida.'},{status:400});
 const key=`${q.get('ugg')}|${q.get('number')}|${ref.year}`;
 const confirmed=confirmedCatalog[key];
 if(confirmed&&Date.now()-Date.parse(confirmed.checkedAt)<24*3600*1000)return NextResponse.json(confirmed,{headers:{'Cache-Control':'private, no-store'}});
 const source=`https://pncp.gov.br/api/consulta/v1/orgaos/${ref.cnpj}/compras/${ref.year}/${ref.sequence}`;
 const response=await fetch(source,{next:{revalidate:86400},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('PNCP indisponível');
 const data=await response.json();
 const verified=String(data.unidadeOrgao?.codigoUnidade)===q.get('ugg')&&Number(data.numeroCompra)===Number(q.get('number'))&&Number(data.anoCompra)===Number(ref.year);
 const origin=typeof data.linkSistemaOrigem==='string'?data.linkSistemaOrigem:null;
 const validOrigin=origin&&/^https:\/\/(cnetmobile\.estaleiro\.serpro\.gov\.br|www\.comprasnet\.gov\.br|comprasnet\.gov\.br)\//.test(origin)?origin:null;
 return NextResponse.json({object:verified&&typeof data.objetoCompra==='string'?data.objetoCompra:'',source,checkedAt:new Date().toISOString(),originUrl:verified?validOrigin:null,verified,error:verified?undefined:'A referência PNCP não corresponde à UGG ou ao número da planilha.'},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'Objeto temporariamente indisponível no PNCP. Consulte o link oficial.'},{status:502});}
}
