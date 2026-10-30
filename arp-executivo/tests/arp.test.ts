import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EMPTY_FILTERS, HEADERS, ataKey, filterEntries, groupEntries, parseBR, parseDate, purchaseKey, safeUrl, toEntries, totalize, type Dataset } from '../lib/arp';
import { EXCEL_COLUMNS, exportExcel, exportPDF } from '../lib/export';
import * as XLSX from 'xlsx';

const dataset:Dataset=JSON.parse(fs.readFileSync(new URL('../data/initial-dataset.json',import.meta.url),'utf8'));
const entries=toEntries(dataset);

test('base real: 26 colunas, 2.121 linhas e identificadores preservados',()=>{
  assert.deepEqual(dataset.headers,[...HEADERS]);assert.equal(entries.length,2121);
  assert.equal(entries[0].raw['Nº ATA'],'00039');assert.equal(entries[0].raw['Nº ITEM'],'00036');
  for(let row=0;row<entries.length;row++)assert.deepEqual(HEADERS.map(h=>entries[row].raw[h]),dataset.rows[row]);
});
test('reconciliação financeira decimal com controles da planilha',()=>{
  const t=totalize(entries);
  assert.equal(t.approvedValue.toFixed(2),'69187343.95');
  assert.equal(t.availableValue.toFixed(2),'3833555.77');
  assert.equal(t.usedValue.toFixed(2),'65353788.18');
  assert.ok(t.availableValue.plus(t.usedValue).eq(t.approvedValue));
  assert.equal(t.normal,271);assert.equal(t.critical,1695);assert.equal(t.empty,155);assert.equal(t.invalid,0);
  for(const e of entries){assert.ok(e.approved.minus(e.available).eq(e.used));assert.ok(e.approved.times(e.price).eq(e.approvedValue));assert.ok(e.availableValue.plus(e.usedValue).eq(e.approvedValue));}
});
test('consolidação sem colisão de UG/UGG/ata e sem média simples de percentuais',()=>{
  const groups=groupEntries(entries);assert.equal(groups.length,399);
  assert.equal(new Set(entries.map(purchaseKey)).size,38);assert.equal(new Set(entries.map(e=>e.raw.CNPJ)).size,325);
  assert.equal(groups.reduce((s,g)=>s+g.entries.length,0),entries.length);
  const sum=groups.reduce((s,g)=>s.plus(g.totals.availableValue),parseBR('0')!);assert.equal(sum.toFixed(2),'3833555.77');
  for(const g of groups){assert.ok(g.entries.every(e=>ataKey(e)===g.key));if(g.totals.approvedValue.gt(0))assert.equal(g.totals.financialPercent,g.totals.usedValue.div(g.totals.approvedValue).times(100).toNumber());}
});
test('busca sem acento e filtros independentes em dados reais',()=>{
  const e=entries.at(-1)!;
  const bySupplier=filterEntries(entries,{...EMPTY_FILTERS,supplier:e.raw.CNPJ});assert.ok(bySupplier.length>0);assert.ok(bySupplier.every(row=>row.raw.CNPJ===e.raw.CNPJ));
  const byUGG=filterEntries(entries,{...EMPTY_FILTERS,ugg:e.raw.UGG,status:e.status});assert.ok(byUGG.length>0);assert.ok(byUGG.every(row=>row.raw.UGG===e.raw.UGG&&row.status===e.status));
  assert.equal(filterEntries(entries,{...EMPTY_FILTERS,query:'concentrado suco'}).every(row=>row.search.includes('concentrado')&&row.search.includes('suco')),true);
  const expired=filterEntries(entries,{...EMPTY_FILTERS,validity:'expirada'},'2026-10-29');assert.ok(expired.every(row=>!!row.ends&&row.ends<'2026-10-29'));
});
test('números vazios e datas não são convertidos silenciosamente',()=>{
  assert.equal(parseBR(''),null);assert.equal(parseBR('2.401')!.toString(),'2401');assert.equal(parseBR('24,10')!.toFixed(2),'24.10');
  assert.equal(parseDate(entries[0].raw['VIGÊNCIA INICIAL']),'2024-11-12');
  assert.throws(()=>parseBR('73.11'));assert.throws(()=>parseDate('31/02/26'));assert.equal(safeUrl('javascript:alert(1)'),null);
});
test('Excel de consulta: uma aba, 16 colunas, dados fiéis, formatos e texto ajustado',async()=>{
  const wb=await exportExcel(entries,dataset,EMPTY_FILTERS,'Filtro atual',false);
  assert.deepEqual(wb.worksheets.map(s=>s.name),['Itens']);
  const sheet=wb.getWorksheet('Itens')!;
  assert.equal(sheet.columnCount,16);assert.equal(sheet.rowCount,entries.length+1);
  assert.equal(sheet.getCell('C2').value,'00039');assert.equal(sheet.getCell('I2').value,73.11);
  assert.equal(sheet.getCell('H2').alignment.wrapText,true);assert.ok(sheet.getRow(2).height!>=32);
  assert.equal(sheet.getCell('M2').numFmt,'dd/mm/yyyy');assert.equal(sheet.getCell('P2').numFmt,'#,##0.######');
  assert.equal(sheet.views[0].state,'frozen');
  const saved=await wb.xlsx.writeBuffer();
  const roundtrip=XLSX.read(saved,{type:'buffer',cellDates:false});
  assert.deepEqual(roundtrip.SheetNames,['Itens']);
  const data=XLSX.utils.sheet_to_json<unknown[]>(roundtrip.Sheets.Itens,{header:1,raw:true,defval:null});
  assert.deepEqual(data[0],[...EXCEL_COLUMNS]);
  for(let i=0;i<entries.length;i++)for(let c=0;c<EXCEL_COLUMNS.length;c++){
    const h=EXCEL_COLUMNS[c],e=entries[i],actual=data[i+1][c];
    const numeric=h==='VALOR UNITÁRIO'?e.price:h==='QTD HOMOLOGADA'?e.approved:h==='QTD REGISTRADA'?e.registered:h==='QTD DISPONÍVEL'?e.available:null;
    const date=h==='VIGÊNCIA INICIAL'?e.starts:h==='VIGÊNCIA FINAL'?e.ends:null;
    if(date)assert.equal(actual,(Date.parse(date+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000);
    else if(numeric)assert.equal(actual,e.raw[h]===''?null:numeric.toNumber());
    else assert.equal(actual,e.raw[h]||null);
  }
  const selected=entries.filter(e=>e.search.includes('banana'));
  const small=await exportExcel(selected,dataset,EMPTY_FILTERS,'Selecionados',false);
  assert.equal(small.getWorksheet('Itens')!.rowCount,selected.length+1);
});
test('PDF executivo: relatório real, grupos e paginação válida',async()=>{
  const doc=await exportPDF(entries,dataset,EMPTY_FILTERS,'Filtro atual',false);
  assert.ok(doc.getNumberOfPages()>1);assert.ok(doc.output('arraybuffer').byteLength>20000);
  const content=doc.output();assert.ok(content.startsWith('%PDF-'));assert.ok(content.includes('69.187.343,95'));assert.ok(content.includes('3.833.555,77'));
});
