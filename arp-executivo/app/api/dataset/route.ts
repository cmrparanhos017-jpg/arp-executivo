import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Dataset, HEADERS, toEntries } from '@/lib/arp';

export const dynamic = 'force-dynamic';
const responseHeaders = { 'Cache-Control': 'private, no-store' };

async function cloud(method: 'GET' | 'POST', body?: unknown) {
  const endpoint = process.env.ARP_CLOUD_ENDPOINT;
  const token = process.env.ARP_CLOUD_TOKEN;
  if (!endpoint || !token) return null;
  const response = await fetch(endpoint, {
    method, headers: { 'Content-Type': 'application/json', 'x-arp-token': token },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(25000),
  });
  const data = await response.json();
  return { response, data };
}
export async function GET() {
  try {
    const result = await cloud('GET');
    if (!result) {
      const localFile = process.env.ARP_LOCAL_DATA_FILE;
      if (!localFile) return NextResponse.json({ error: 'Configure o Supabase ou importe uma planilha para usar neste navegador.' }, { status: 503, headers: responseHeaders });
      const dataset = JSON.parse(await readFile(resolve(process.cwd(), localFile), 'utf8')) as Dataset;
      toEntries(dataset);
      return NextResponse.json({ dataset, storage: 'local', version: 0 }, { headers: responseHeaders });
    }
    return NextResponse.json(result.data, { status: result.response.status, headers: responseHeaders });
  } catch {
    return NextResponse.json({ error: 'Não foi possível ler o Supabase. Tente novamente ou importe uma planilha para armazenamento local.' }, { status: 502, headers: responseHeaders });
  }
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).host !== request.headers.get('host')) return NextResponse.json({ error: 'Origem da requisição inválida.' }, { status: 403 });
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 3_900_000) return NextResponse.json({ error: 'A importação excede 3,9 MB de dados.' }, { status: 413 });
    const body = JSON.parse(text) as { dataset: Dataset; baseVersion: number };
    if (!Number.isInteger(body.baseVersion) || body.baseVersion < 0) throw new Error('Versão de sincronização inválida.');
    toEntries(body.dataset);
    const dataset = { ...body.dataset, headers: [...HEADERS], rows: body.dataset.rows.map(row => HEADERS.map(h => row[body.dataset.headers.indexOf(h)])) };
    const result = await cloud('POST', { dataset, baseVersion: body.baseVersion });
    if (!result) return NextResponse.json({ error: 'Supabase não configurado. A opção de armazenamento local está disponível.' }, { status: 503 });
    return NextResponse.json(result.data, { status: result.response.status, headers: responseHeaders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && !error.message.includes('fetch') ? error.message : 'Não foi possível sincronizar. Os dados anteriores foram preservados.' }, { status: 400 });
  }
}
