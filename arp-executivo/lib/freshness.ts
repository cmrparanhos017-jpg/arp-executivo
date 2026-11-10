export const UPDATE_NOTICE_SESSION_KEY = 'arp-update-notice-v1';
const DAY_MS = 86400000;
export function baseFreshness(importedAt:string|null|undefined, now=Date.now()) {
 const stamp=typeof importedAt==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(importedAt)?Date.parse(importedAt):NaN;
 if(!Number.isFinite(stamp)||stamp>now)return {known:false,stale:false,days:null,dateLabel:'Data de atualização não informada',ageLabel:'Não informado'};
 const elapsed=now-stamp,days=Math.floor(elapsed/DAY_MS);
 return {known:true,stale:elapsed>10*DAY_MS,days,dateLabel:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(stamp)),ageLabel:`${days} ${days===1?'dia':'dias'}`};
}
export function updateNoticeId(source:string,version:number,importedAt:string|null|undefined,stale:boolean){return `${source}:${version}:${importedAt??'unknown'}:${stale?'stale':'current'}`;}
