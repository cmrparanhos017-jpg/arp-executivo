import { dateLabel, type Entry } from './arp';
export function ataValidity(entries: Pick<Entry,'starts'|'ends'>[], today:string) {
 const periods=new Set(entries.map(e=>`${e.starts??''}|${e.ends??''}`));
 if(periods.size!==1)return {label:'Vigências distintas: consulte as datas de cada item',status:'Por item'};
 const {starts,ends}=entries[0];
 const label=`${dateLabel(starts)} até ${dateLabel(ends)}`;
 const status=ends&&ends<today?'Vencida':starts&&starts>today?'Vigência futura':starts&&ends?'Vigente':'Datas incompletas';
 return {label,status};
}
