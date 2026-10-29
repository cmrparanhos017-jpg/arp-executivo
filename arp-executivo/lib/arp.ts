import Decimal from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const HEADERS = ['UG', 'SIGLA', 'TIPO', 'UGG', 'NOME UGG', 'Nº ATA', 'ANO ATA', 'Nº COMPRA', 'ANO COMPRA', 'LINK ATA PNCP', 'LINK COMPRA PNCP', 'MODALIDADE', 'CÓD ITEM', 'Nº ITEM', 'DESCRIÇÃO', 'TIPO ITEM', 'VALOR UNITÁRIO', 'CNPJ', 'NOME CNPJ', 'QTD HOMOLOGADA', 'VIGÊNCIA INICIAL', 'VIGÊNCIA FINAL', 'LINK ITEM', 'QTD REGISTRADA', 'QTD DISPONÍVEL', 'ARQUIVOS'] as const;
export type Column = typeof HEADERS[number];
export type Raw = Record<Column, string>;
export type Dataset = { filename: string; headers: string[]; rows: string[][]; contentHash: string; version?: number; importedAt?: string };
export type BalanceStatus = 'Normal' | 'Crítico' | 'Esgotado' | 'Revisar';
export type Entry = { id: string; line: number; raw: Raw; price: Decimal; approved: Decimal; registered: Decimal | null; available: Decimal; used: Decimal; approvedValue: Decimal; availableValue: Decimal; usedValue: Decimal; usedPercent: number | null; status: BalanceStatus; warning: string | null; starts: string | null; ends: string | null; search: string };
export type Totals = { count: number; approved: Decimal; available: Decimal; used: Decimal; approvedValue: Decimal; availableValue: Decimal; usedValue: Decimal; usedPercent: number | null; financialPercent: number | null; critical: number; empty: number; normal: number; invalid: number };
export type Group = { key: string; entries: Entry[]; raw: Raw; totals: Totals };
export type Filters = { query: string; modality: string; ug: string; ugg: string; supplier: string; status: string; purchase: string; ata: string; role: string; itemType: string; validity: string };
export const EMPTY_FILTERS: Filters = { query: '', modality: '', ug: '', ugg: '', supplier: '', status: '', purchase: '', ata: '', role: '', itemType: '', validity: '' };
export const METHODOLOGY = 'Consumo calculado = QTD HOMOLOGADA − QTD DISPONÍVEL, conforme a fórmula solicitada. Não representa comprovação de empenhos emitidos. A QTD REGISTRADA permanece separada, pois pode ter abrangência diferente da quantidade homologada.';

export function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
export function parseBR(value: string): Decimal | null {
  const clean = value.replace(/\s|R\$/g, '');
  if (!clean) return null;
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(clean)) throw new Error(`Número inválido: “${value}”. Esperado formato brasileiro.`);
  const result = new Decimal(clean.replace(/\./g, '').replace(',', '.'));
  if (!result.isFinite()) throw new Error(`Número inválido: “${value}”.`);
  return result;
}
export function parseDate(value: string): string | null {
  if (!value.trim()) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) throw new Error(`Data inválida: “${value}”. Use dia/mês/ano.`);
  const day = Number(match[1]), month = Number(match[2]);
  let year = Number(match[3]);
  if (match[3].length === 2) year += year < 70 ? 2000 : 1900;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(`Data inválida: “${value}”.`);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function todayBR() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function dateLabel(value: string | null) { return value ? value.split('-').reverse().join('/') : 'Não informado'; }
export function validateDataset(dataset: Dataset) {
  if (!dataset || typeof dataset.filename !== 'string' || !Array.isArray(dataset.headers) || !Array.isArray(dataset.rows)) throw new Error('Estrutura da planilha inválida.');
  const headers = dataset.headers.map(h => String(h).trim());
  const missing = HEADERS.filter(h => !headers.includes(h));
  if (missing.length) throw new Error(`Colunas ausentes: ${missing.join(', ')}.`);
  if (new Set(headers).size !== headers.length) throw new Error('A planilha contém cabeçalhos duplicados.');
  if (!dataset.rows.length) throw new Error('A planilha não contém itens.');
  if (dataset.rows.length > 25000) throw new Error('Limite de 25.000 itens por importação.');
  if (dataset.rows.some(row => !Array.isArray(row) || row.length !== headers.length || row.some(cell => typeof cell !== 'string'))) throw new Error('Há linhas com quantidade de colunas ou tipos de células inválidos.');
  return headers;
}
export function toEntries(dataset: Dataset): Entry[] {
  const headers = validateDataset(dataset);
  const positions = HEADERS.map(h => headers.indexOf(h));
  return dataset.rows.map((cells, index) => {
    const raw = Object.fromEntries(HEADERS.map((header, i) => [header, cells[positions[i]]])) as Raw;
    try {
      const price = parseBR(raw['VALOR UNITÁRIO']), approved = parseBR(raw['QTD HOMOLOGADA']), available = parseBR(raw['QTD DISPONÍVEL']);
      if (price === null || approved === null || available === null) throw new Error('Valor unitário, quantidade homologada e disponível são obrigatórios. Células vazias não são zero.');
      const registered = parseBR(raw['QTD REGISTRADA']);
      const used = approved.minus(available);
      const warning = price.lt(0) || approved.lt(0) || available.lt(0) || available.gt(approved) ? 'Revisar: quantidade ou valor negativo, ou disponível maior que homologado.' : null;
      const status: BalanceStatus = warning ? 'Revisar' : available.isZero() ? 'Esgotado' : approved.gt(0) && available.div(approved).lt('0.15') ? 'Crítico' : 'Normal';
      return { id: `${dataset.contentHash}:${index}`, line: index + 2, raw, price, approved, registered, available, used, approvedValue: approved.times(price), availableValue: available.times(price), usedValue: used.times(price), usedPercent: approved.gt(0) ? used.div(approved).times(100).toNumber() : null, status, warning, starts: parseDate(raw['VIGÊNCIA INICIAL']), ends: parseDate(raw['VIGÊNCIA FINAL']), search: normalize(Object.values(raw).join(' ')) };
    } catch (error) { throw new Error(`Linha ${index + 2}: ${error instanceof Error ? error.message : 'dado inválido'}`); }
  });
}
export function totalize(entries: Entry[]): Totals {
  const total: Totals = { count: entries.length, approved: new Decimal(0), available: new Decimal(0), used: new Decimal(0), approvedValue: new Decimal(0), availableValue: new Decimal(0), usedValue: new Decimal(0), usedPercent: null, financialPercent: null, critical: 0, empty: 0, normal: 0, invalid: 0 };
  for (const e of entries) {
    total.approved = total.approved.plus(e.approved); total.available = total.available.plus(e.available); total.used = total.used.plus(e.used);
    total.approvedValue = total.approvedValue.plus(e.approvedValue); total.availableValue = total.availableValue.plus(e.availableValue); total.usedValue = total.usedValue.plus(e.usedValue);
    if (e.status === 'Crítico') total.critical++; else if (e.status === 'Esgotado') total.empty++; else if (e.status === 'Normal') total.normal++; else total.invalid++;
  }
  total.usedPercent = total.approved.gt(0) ? total.used.div(total.approved).times(100).toNumber() : null;
  total.financialPercent = total.approvedValue.gt(0) ? total.usedValue.div(total.approvedValue).times(100).toNumber() : null;
  return total;
}
export function ataKey(e: Entry) { return JSON.stringify([e.raw.UG, e.raw.UGG, e.raw['NOME UGG'], e.raw['Nº ATA'], e.raw['ANO ATA']]); }
export function purchaseKey(e: Entry) { return `${e.raw.UGG}|${e.raw['Nº COMPRA']}|${e.raw['ANO COMPRA']}`; }
export function groupEntries(entries: Entry[]): Group[] {
  const map = new Map<string, Entry[]>();
  for (const entry of entries) { const key = ataKey(entry); const list = map.get(key) ?? []; list.push(entry); map.set(key, list); }
  return [...map].map(([key, list]) => ({ key, entries: list, raw: list[0].raw, totals: totalize(list) }));
}
export function filterEntries(entries: Entry[], f: Filters, today = todayBR()) {
  const words = normalize(f.query.trim()).split(/\s+/).filter(Boolean);
  return entries.filter(e => words.every(w => e.search.includes(w)) && (!f.modality || e.raw.MODALIDADE === f.modality) && (!f.ug || e.raw.UG === f.ug) && (!f.ugg || e.raw.UGG === f.ugg) && (!f.supplier || e.raw.CNPJ === f.supplier) && (!f.status || e.status === f.status) && (!f.purchase || purchaseKey(e) === f.purchase) && (!f.ata || ataKey(e) === f.ata) && (!f.role || e.raw.TIPO === f.role) && (!f.itemType || e.raw['TIPO ITEM'] === f.itemType) && (!f.validity || (f.validity === 'vigente' ? !!e.starts && !!e.ends && e.starts <= today && e.ends >= today : f.validity === 'expirada' ? !!e.ends && e.ends < today : !!e.starts && e.starts > today)));
}
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
export function money(value: Decimal | number) { return BRL.format(typeof value === 'number' ? value : value.toDecimalPlaces(2).toNumber()); }
export function number(value: Decimal | number) { return (typeof value === 'number' ? value : value.toNumber()).toLocaleString('pt-BR', { maximumFractionDigits: 6 }); }
export function percent(value: number | null) { return value === null ? 'Não aplicável' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`; }
export function clampPercent(value: number | null) { return Math.min(100, Math.max(0, value ?? 0)); }
export function safeUrl(value: string) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; } }
export function fileLinks(value: string) { return [...new Set(value.match(/https?:\/\/[^\s<>"']+/g) ?? [])].map(safeUrl).filter((u): u is string => !!u); }

/** HTML disfarçado de XLS é comum nas exportações do Compras.gov. */
export async function parseUpload(file: File): Promise<Dataset> {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Selecione uma planilha .xlsx, .xls ou .csv.');
  if (file.size > 20 * 1024 * 1024) throw new Error('O arquivo deve ter até 20 MB.');
  const buffer = await file.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(buffer);
  if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(buffer);
  let grid: string[][] = [];
  if (/<(?:html|table|tr|td)\b/i.test(text.slice(0, 4000))) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    for (const table of Array.from(doc.querySelectorAll('table'))) {
      const rows = Array.from(table.querySelectorAll('tr')).map(row => Array.from(row.querySelectorAll('th,td')).map(cell => {
        const clone = cell.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        const value = (clone.textContent ?? '').trim();
        const links = Array.from(clone.querySelectorAll('a')).map(a => safeUrl(a.getAttribute('href') ?? '')).filter((u): u is string => !!u);
        return links.length && !links.every(url => value.includes(url)) ? `${value}${value ? '\n' : ''}${links.join('\n')}` : value;
      }));
      const header = rows.findIndex(row => HEADERS.every(h => row.map(c => c.trim()).includes(h)));
      if (header >= 0) { grid = rows.slice(header); break; }
    }
  } else {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false, cellNF: true, cellText: true, raw: true, codepage: 65001 });
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const formatted = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '', blankrows: true });
      const headerRow = formatted.findIndex(row => HEADERS.every(h => row.map(c => String(c).trim()).includes(h)));
      if (headerRow < 0) continue;
      const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
      const header = formatted[headerRow].map(String);
      const numeric = new Set(['VALOR UNITÁRIO', 'QTD HOMOLOGADA', 'QTD REGISTRADA', 'QTD DISPONÍVEL']);
      grid = [header];
      for (let row = range.s.r + headerRow + 1; row <= range.e.r; row++) {
        const values = header.map((h, col) => {
          const cell = ws[XLSX.utils.encode_cell({ r: row, c: range.s.c + col })];
          if (!cell) return '';
          if (numeric.has(h) && typeof cell.v === 'number') return String(cell.v).replace('.', ',');
          if (h.startsWith('VIGÊNCIA') && typeof cell.v === 'number') { const d = XLSX.SSF.parse_date_code(cell.v); return `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.y}`; }
          if ((h.startsWith('LINK') || h === 'ARQUIVOS') && cell.l?.Target) return String(cell.l.Target);
          return String(cell.w ?? cell.v ?? '').trim();
        });
        grid.push(values);
      }
      break;
    }
  }
  if (!grid.length) throw new Error('Não foi encontrada uma aba ou tabela com as 26 colunas exigidas.');
  const headers = grid[0].map(h => h.trim());
  const rows = grid.slice(1).filter(row => row.some(cell => cell.trim())).filter(row => !HEADERS.every((h, i) => row[i] === h));
  const canonical = rows.map((row, index) => {
    if (row.length > headers.length && row.slice(headers.length).some(Boolean)) throw new Error(`Linha ${index + 2}: colunas excedentes.`);
    return HEADERS.map(h => row[headers.indexOf(h)] ?? '');
  });
  const digest = globalThis.crypto?.subtle
    ? new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))
    : (await import('@noble/hashes/sha2.js')).sha256(new Uint8Array(buffer));
  const dataset: Dataset = { filename: file.name, headers: [...HEADERS], rows: canonical, contentHash: Array.from(digest).map(n => n.toString(16).padStart(2, '0')).join(''), importedAt: new Date().toISOString() };
  toEntries(dataset);
  if (new TextEncoder().encode(JSON.stringify(dataset)).length > 3_800_000) throw new Error('Os dados extraídos excedem 3,8 MB. Divida a planilha antes de sincronizar.');
  return dataset;
}
