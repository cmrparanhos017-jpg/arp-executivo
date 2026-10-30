import { Decimal } from 'decimal.js';
import { METHODOLOGY, type Dataset, type Entry, type Filters, groupEntries, money, number, percent, totalize } from './arp';

function filename(prefix: string) { return `${prefix}_${new Date().toISOString().slice(0, 10)}`; }
export function filterDescription(f: Filters) { return Object.entries(f).filter(([, v]) => v).map(([key, value]) => `${({query:'Busca',modality:'Modalidade',ug:'UG',ugg:'UGG',supplier:'CNPJ',status:'Saldo',purchase:'Compra',ata:'Ata',role:'Participação',itemType:'Tipo do item',validity:'Vigência'} as Record<string,string>)[key]}: ${value}`).join(' · ') || 'Base completa'; }

export const EXCEL_COLUMNS = ['UGG','NOME UGG','Nº ATA','ANO ATA','Nº COMPRA','ANO COMPRA','Nº ITEM','DESCRIÇÃO','VALOR UNITÁRIO','CNPJ','NOME CNPJ','QTD HOMOLOGADA','VIGÊNCIA INICIAL','VIGÊNCIA FINAL','QTD REGISTRADA','QTD DISPONÍVEL'] as const;

export async function exportExcel(entries: Entry[], _dataset: Dataset, _filters: Filters, scope: string, save = true) {
  if (!entries.length) throw new Error('Não há itens para exportar.');
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Itens', { views:[{state:'frozen', ySplit:1, xSplit:2}], pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0} });
  const widths = [12,38,14,12,16,14,12,80,20,23,42,20,20,20,20,20];
  sheet.columns = EXCEL_COLUMNS.map((h,i)=>({header:h,key:h,width:widths[i]}));
  sheet.autoFilter = {from:'A1',to:`P${entries.length+1}`};
  const numeric = new Set<string>(['VALOR UNITÁRIO','QTD HOMOLOGADA','QTD REGISTRADA','QTD DISPONÍVEL']);
  // Estimate wrapped height from words and explicit line breaks; never shorten source text.
  const lineCount = (text:string,width:number) => text.split(/\r?\n/).reduce((sum,line)=>{
    let lines=1,used=0;
    for(const word of line.split(/\s+/)){if(!word)continue;const length=word.length;
      if(used&&used+1+length>width){lines++;used=0;}
      if(length>width){lines+=Math.floor((length-1)/width);used=length%width||width;}else used+=length+(used?1:0);
    }return sum+lines;
  },0);
  entries.forEach((entry,index)=>{
    const row = sheet.addRow(EXCEL_COLUMNS.map(h=>{
      if(h==='VALOR UNITÁRIO')return entry.raw[h]===''?null:entry.price.toNumber();
      if(h==='QTD HOMOLOGADA')return entry.raw[h]===''?null:entry.approved.toNumber();
      if(h==='QTD REGISTRADA')return entry.registered?.toNumber()??null;
      if(h==='QTD DISPONÍVEL')return entry.raw[h]===''?null:entry.available.toNumber();
      if(h==='VIGÊNCIA INICIAL'&&entry.starts)return (Date.parse(`${entry.starts}T00:00:00Z`)-Date.UTC(1899,11,30))/86400000;
      if(h==='VIGÊNCIA FINAL'&&entry.ends)return (Date.parse(`${entry.ends}T00:00:00Z`)-Date.UTC(1899,11,30))/86400000;
      return entry.raw[h];
    }));
    row.font={name:'Calibri',size:11,color:{argb:'FF18283B'}};
    row.alignment={vertical:'middle',wrapText:true};
    row.eachCell({includeEmpty:true},(cell,col)=>{
      const h=EXCEL_COLUMNS[col-1];
      cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:index%2?'FFF0F5FA':'FFFFFFFF'}};
      cell.border={bottom:{style:'hair',color:{argb:'FFD8E3EE'}}};
      cell.alignment={vertical:'middle',wrapText:true,horizontal:numeric.has(h)?'right':'left'};
      cell.numFmt=h==='VALOR UNITÁRIO'?'"R$" #,##0.00######':numeric.has(h)?'#,##0.######':h.startsWith('VIGÊNCIA')&&typeof cell.value==='number'?'dd/mm/yyyy':'@';
    });
    row.height=Math.min(409,Math.max(32,...EXCEL_COLUMNS.map((h,i)=>lineCount(entry.raw[h],Math.max(8,widths[i]-3))*16+12)));
  });
  const header=sheet.getRow(1);
  header.height=44;
  header.eachCell(cell=>{cell.font={name:'Calibri',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173F62'}};cell.alignment={vertical:'middle',wrapText:true,horizontal:'left'};});
  if(save){
    const bytes=await wb.xlsx.writeBuffer();
    const url=URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    const link=document.createElement('a');link.href=url;link.download=`${filename('ARP_'+scope.replace(/\s/g,'_'))}.xlsx`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
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
