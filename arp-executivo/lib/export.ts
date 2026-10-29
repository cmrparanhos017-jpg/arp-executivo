import { Decimal } from 'decimal.js';
import { HEADERS, METHODOLOGY, type Column, type Dataset, type Entry, type Filters, groupEntries, money, number, percent, safeUrl, totalize } from './arp';

function filename(prefix: string) { return `${prefix}_${new Date().toISOString().slice(0, 10)}`; }
export function filterDescription(f: Filters) { return Object.entries(f).filter(([, v]) => v).map(([key, value]) => `${({query:'Busca',modality:'Modalidade',ug:'UG',ugg:'UGG',supplier:'CNPJ',status:'Saldo',purchase:'Compra',ata:'Ata',role:'Participação',itemType:'Tipo do item',validity:'Vigência'} as Record<string,string>)[key]}: ${value}`).join(' · ') || 'Base completa'; }

export async function exportExcel(entries: Entry[], dataset: Dataset, filters: Filters, scope: string, save = true) {
  if (!entries.length) throw new Error('Não há itens para exportar.');
  const XLSX = await import('xlsx');
  const numeric = new Set<Column>(['VALOR UNITÁRIO','QTD HOMOLOGADA','QTD REGISTRADA','QTD DISPONÍVEL']);
  const headers = [...HEADERS, 'QTD CONSUMIDA CALCULADA', 'VALOR TOTAL HOMOLOGADO', 'VALOR CONSUMIDO CALCULADO', 'VALOR DISPONÍVEL', '% CONSUMIDO CALCULADO', 'STATUS DO SALDO', 'LINHA ORIGINAL'];
  const rows = entries.map(e => [...HEADERS.map(h => numeric.has(h) ? e.raw[h] === '' ? null : h === 'VALOR UNITÁRIO' ? e.price.toNumber() : h === 'QTD HOMOLOGADA' ? e.approved.toNumber() : h === 'QTD DISPONÍVEL' ? e.available.toNumber() : e.registered?.toNumber() ?? null : e.raw[h]), e.used.toNumber(), e.approvedValue.toDecimalPlaces(2).toNumber(), e.usedValue.toDecimalPlaces(2).toNumber(), e.availableValue.toDecimalPlaces(2).toNumber(), e.usedPercent === null ? null : e.usedPercent / 100, e.status, e.line]);
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet['!autofilter'] = { ref: `A1:AG${rows.length + 1}` };
  sheet['!cols'] = headers.map(h => ({ wch: h === 'DESCRIÇÃO' ? 65 : h.includes('LINK') || h === 'ARQUIVOS' ? 42 : h.includes('NOME') ? 35 : h.includes('VALOR') ? 24 : 20 }));
  const fmt = '#,##0.######', currency = '"R$" #,##0.00';
  entries.forEach((entry, i) => {
    const r = i + 2;
    for (const col of ['Q','T','X','Y','AA']) { const c = sheet[`${col}${r}`]; if (c) c.z = col === 'Q' ? '"R$" #,##0.00######' : fmt; }
    for (const [col, formula, value] of [['AA', `T${r}-Y${r}`, entry.used], ['AB', `T${r}*Q${r}`, entry.approvedValue], ['AC', `AA${r}*Q${r}`, entry.usedValue], ['AD', `Y${r}*Q${r}`, entry.availableValue]] as const) sheet[`${col}${r}`] = { t: 'n', f: formula, v: value.toNumber(), z: col === 'AA' ? fmt : currency };
    sheet[`AE${r}`] = entry.usedPercent === null ? { t:'s', v:'Não aplicável', f:`IF(T${r}>0,AA${r}/T${r},"Não aplicável")` } : { t:'n', f:`IF(T${r}>0,AA${r}/T${r},0)`, v:entry.usedPercent/100, z:'0.0%' };
    for (const [col, value] of [['U', entry.starts], ['V', entry.ends]] as const) if (value) sheet[`${col}${r}`] = { t:'n', v: (Date.parse(`${value}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000, z:'dd/mm/yyyy' };
    for (const col of ['J','K','W']) { const cell = sheet[`${col}${r}`]; const url = cell && safeUrl(String(cell.v)); if (url) cell.l = { Target:url }; }
  });
  const total = totalize(entries);
  const summary = XLSX.utils.aoa_to_sheet([
    ['GESTÃO DE PREGÕES E SALDOS DE ARP'], ['Arquivo de origem', dataset.filename], ['Escopo',scope], ['Filtros',filterDescription(filters)], ['Itens',entries.length], ['Atas',groupEntries(entries).length],
    ['Valor total homologado',total.approvedValue.toNumber()], ['Consumo calculado',total.usedValue.toNumber()], ['Valor disponível',total.availableValue.toNumber()], ['Consumo financeiro calculado',total.financialPercent === null ? null : total.financialPercent/100], ['Itens críticos',total.critical], ['Itens esgotados',total.empty], [], ['Metodologia',METHODOLOGY], ['Regra do saldo','Crítico: 0 < disponível / homologada < 15%. Esgotado: disponível = 0. Normal: saldo a partir de 15%.'], ['Agregação','Percentual quantitativo = soma consumida / soma homologada. Percentual financeiro = soma do valor consumido / soma do valor homologado. Não é média dos percentuais.'], ['Precisão','Cálculo decimal; arredondamento de apresentação a centavos. Células de origem preservadas na aba Originais.'], ['Limite de interpretação','As quantidades de itens distintos podem usar unidades diferentes. Os valores não descontam atas vencidas, exceto quando o filtro de vigência é aplicado.']
  ]);
  summary['!cols']=[{wch:32},{wch:110}];
  for(const row of [7,8,9]) summary[`B${row}`].z=currency;
  if(summary.B10) summary.B10.z='0.0%';
  const ataRows = groupEntries(entries).map(g=>[g.raw.UG,g.raw.UGG,g.raw['NOME UGG'],g.raw['Nº ATA'],g.raw['ANO ATA'],g.raw['Nº COMPRA'],g.raw['ANO COMPRA'],g.entries.length,g.totals.approved.toNumber(),g.totals.available.toNumber(),g.totals.used.toNumber(),g.totals.approvedValue.toNumber(),g.totals.usedValue.toNumber(),g.totals.availableValue.toNumber(),g.totals.usedPercent===null?null:g.totals.usedPercent/100,g.totals.financialPercent===null?null:g.totals.financialPercent/100]);
  const atas=XLSX.utils.aoa_to_sheet([['UG','UGG','NOME UGG','Nº ATA','ANO ATA','Nº COMPRA','ANO COMPRA','ITENS','QTD HOMOLOGADA','QTD DISPONÍVEL','QTD CONSUMIDA CALCULADA','VALOR HOMOLOGADO','CONSUMO CALCULADO','VALOR DISPONÍVEL','% QUANTITATIVO','% FINANCEIRO'],...ataRows]);
  atas['!cols']=Array.from({length:16},(_,i)=>({wch:i===2?32:24}));
  ataRows.forEach((_,i)=>{for(const c of ['L','M','N'])atas[`${c}${i+2}`].z=currency;for(const c of ['O','P'])if(atas[`${c}${i+2}`])atas[`${c}${i+2}`].z='0.0%';});
  const originals=XLSX.utils.aoa_to_sheet([[...HEADERS],...entries.map(e=>HEADERS.map(h=>e.raw[h]))]);
  originals['!cols']=sheet['!cols']?.slice(0,26);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,summary,'Resumo'); XLSX.utils.book_append_sheet(wb,sheet,'Itens'); XLSX.utils.book_append_sheet(wb,atas,'Atas'); XLSX.utils.book_append_sheet(wb,originals,'Originais');
  if(save) XLSX.writeFile(wb,`${filename('ARP_'+scope.replace(/\s/g,'_'))}.xlsx`,{compression:true});
  return wb;
}

export async function exportPDF(entries: Entry[], dataset: Dataset, filters: Filters, scope: string, save = true) {
  if(!entries.length)throw new Error('Não há itens para o relatório.');
  const [{jsPDF},{default:autoTable}] = await Promise.all([import('jspdf'),import('jspdf-autotable')]);
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const width=doc.internal.pageSize.getWidth(), total=totalize(entries), groups=groupEntries(entries);
  doc.setFillColor(11,18,30);doc.rect(0,0,width,43,'F');
  doc.setTextColor(212,250,139);doc.setFontSize(10);doc.text('ARP / INTELIGÊNCIA EM CONTRATAÇÕES',14,13);
  doc.setTextColor(255,255,255);doc.setFontSize(22);doc.text('Relatório executivo de saldos',14,26);
  doc.setFontSize(9);doc.text(`${scope} | ${number(entries.length)} itens | ${number(groups.length)} atas | ${new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}`,14,35);
  doc.setTextColor(40,50,65);doc.setFontSize(9);
  doc.text(doc.splitTextToSize(`Fonte: ${dataset.filename}. Filtros: ${filterDescription(filters)}`,width-28),14,50);
  autoTable(doc,{startY:66,head:[['Total homologado','Consumo calculado','Saldo disponível','Consumo financeiro']],body:[[money(total.approvedValue),money(total.usedValue),money(total.availableValue),percent(total.financialPercent)]],theme:'grid',headStyles:{fillColor:[26,40,55]},styles:{fontSize:11,cellPadding:4},margin:{left:14,right:14}});
  doc.setFontSize(8);doc.text(doc.splitTextToSize(METHODOLOGY+' Saldo crítico: disponível menor que 15% da quantidade homologada; esgotado: disponível igual a zero. Valores incluem atas vencidas quando não há filtro de vigência.',width-28),14,100);
  autoTable(doc,{startY:116,head:[['Ata / ano','UGG / Gerenciadora','Compra / ano','Itens','Homologado (R$)','Consumo calculado (R$)','Disponível (R$)','Consumo financeiro']],body:groups.map(g=>[`${g.raw['Nº ATA']}/${g.raw['ANO ATA']}`,`${g.raw.UGG} / ${g.raw['NOME UGG']}`,`${g.raw['Nº COMPRA']}/${g.raw['ANO COMPRA']}`,g.entries.length,money(g.totals.approvedValue),money(g.totals.usedValue),money(g.totals.availableValue),percent(g.totals.financialPercent)]),theme:'striped',headStyles:{fillColor:[26,40,55]},styles:{fontSize:8,cellPadding:3,overflow:'linebreak'},columnStyles:{1:{cellWidth:48},4:{halign:'right'},5:{halign:'right'},6:{halign:'right'}},margin:{left:14,right:14,bottom:18}});
  const pages=doc.getNumberOfPages();
  for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(7);doc.setTextColor(100,110,120);doc.text('Consumo calculado por diferença de quantidades; não comprova emissão de empenhos. | Detalhamento dos itens disponível no Excel.',14,doc.internal.pageSize.getHeight()-9);doc.text(`${i} / ${pages}`,width-25,doc.internal.pageSize.getHeight()-9);}
  if(save) doc.save(`${filename('ARP_Relatorio_Executivo')}.pdf`);
  return doc;
}
