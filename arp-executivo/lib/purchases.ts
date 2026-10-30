import catalog from './pncp-catalog.json';
import { groupEntries,purchaseKey,totalize,type Entry } from './arp';
export function groupPurchases(entries:Entry[]) {
 const map=new Map<string,Entry[]>();
 for(const e of entries){const key=purchaseKey(e);const list=map.get(key)??[];list.push(e);map.set(key,list);}
 return [...map].map(([key,items])=>({key,entries:items,raw:items[0].raw,atas:groupEntries(items),totals:totalize(items)}));
}
export function pncpReference(link:string){
 try{const u=new URL(link);if(u.hostname!=='pncp.gov.br')return null;const m=u.pathname.match(/^\/app\/editais\/(\d{14})\/(\d{4})\/(\d+)\/?$/);return m?{cnpj:m[1],year:m[2],sequence:String(Number(m[3]))}:null;}catch{return null;}
}
export function itemDestination(raw:Record<string,string>){
 const legacy=/^https:\/\/contratos\.(sistema\.gov\.br|comprasnet\.gov\.br)\/transparencia\/arpshow\//.test(raw['LINK ITEM']);
 return {url:legacy?purchasePageUrl(raw):raw['LINK ITEM'],label:legacy?'Itens no PNCP':'Item',legacy};
}
export type PurchaseInfo={object:string;source:string;checkedAt:string;originUrl:string|null;verified:boolean;error?:string};

export const confirmedCatalog = catalog as Record<string,PurchaseInfo>;
export function purchasePageUrl(raw:Record<string,string>){
 const info=confirmedCatalog[`${raw.UGG}|${raw['Nº COMPRA']}|${raw['ANO COMPRA']}`];
 const m=info?.source.match(/\/orgaos\/(\d{14})\/compras\/(\d{4})\/(\d+)$/);
 if(m)return `https://pncp.gov.br/app/editais/${m[1]}/${m[2]}/${m[3]}`;
 const ref=pncpReference(raw['LINK COMPRA PNCP']);
 return ref&&ref.year===raw['ANO COMPRA']?raw['LINK COMPRA PNCP']:'https://pncp.gov.br/app/editais';
}
