import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

// O hash não é uma credencial. A chave original fica apenas no servidor Next.js.
const TOKEN_HASH = Deno.env.get('ARP_TOKEN_SHA256') ?? '93cb77a196149f15a994d3c375fd306d34ef6505e5b70ac928b2922e18d5b80f';
const HEADERS = ['UG', 'SIGLA', 'TIPO', 'UGG', 'NOME UGG', 'Nº ATA', 'ANO ATA', 'Nº COMPRA', 'ANO COMPRA', 'LINK ATA PNCP', 'LINK COMPRA PNCP', 'MODALIDADE', 'CÓD ITEM', 'Nº ITEM', 'DESCRIÇÃO', 'TIPO ITEM', 'VALOR UNITÁRIO', 'CNPJ', 'NOME CNPJ', 'QTD HOMOLOGADA', 'VIGÊNCIA INICIAL', 'VIGÊNCIA FINAL', 'LINK ITEM', 'QTD REGISTRADA', 'QTD DISPONÍVEL', 'ARQUIVOS'];
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
Deno.serve(async (request: Request) => {
  const token = request.headers.get('x-arp-token') ?? '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(digest)).map(n => n.toString(16).padStart(2, '0')).join('');
  if (hash !== TOKEN_HASH) return json({ error: 'Acesso não autorizado.' }, 401);
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Método não permitido.' }, 405);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: head, error: headError } = await db.from('arp_workspace').select('version,current_dataset').eq('id', true).maybeSingle();
    if (headError) throw headError;
    if (request.method === 'GET') {
      if (!head) return json({ error: 'Nenhuma planilha foi importada.' }, 404);
      const { data, error } = await db.from('arp_datasets').select('*').eq('id', head.current_dataset).single();
      if (error) throw error;
      return json({ dataset: { filename: data.filename, headers: data.headers, rows: data.rows, contentHash: data.content_hash, importedAt: data.created_at }, version: head.version, storage: 'supabase' });
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 3_900_000) return json({ error: 'Importação grande demais.' }, 413);
    const { dataset, baseVersion } = JSON.parse(raw);
    if (!Number.isInteger(baseVersion) || baseVersion !== (head?.version ?? 0)) return json({ error: 'A base foi atualizada em outra sessão. Recarregue os dados antes de sincronizar.' }, 409);
    if (!dataset || typeof dataset.filename !== 'string' || !/^[a-f0-9]{64}$/.test(dataset.contentHash) || JSON.stringify(dataset.headers) !== JSON.stringify(HEADERS) || !Array.isArray(dataset.rows) || dataset.rows.length === 0 || dataset.rows.length > 25000 || dataset.rows.some((r: unknown) => !Array.isArray(r) || r.length !== 26 || r.some(c => typeof c !== 'string'))) return json({ error: 'Estrutura da planilha inválida.' }, 400);
    let { data: snapshot, error: findError } = await db.from('arp_datasets').select('id').eq('content_hash', dataset.contentHash).maybeSingle();
    if (findError) throw findError;
    if (!snapshot) {
      const result = await db.from('arp_datasets').insert({ filename: dataset.filename, headers: dataset.headers, rows: dataset.rows, row_count: dataset.rows.length, content_hash: dataset.contentHash }).select('id').single();
      if (result.error) {
        if (result.error.code !== '23505') throw result.error;
        const retry = await db.from('arp_datasets').select('id').eq('content_hash', dataset.contentHash).single();
        if (retry.error) throw retry.error;
        snapshot = retry.data;
      } else snapshot = result.data;
    }
    // Compare-and-swap: nenhuma importação pode sobrescrever uma sessão mais nova.
    const { data: changed, error } = head
      ? await db.from('arp_workspace').update({ current_dataset: snapshot!.id, version: head.version + 1 }).eq('id', true).eq('version', baseVersion).select('version')
      : await db.from('arp_workspace').insert({ id: true, current_dataset: snapshot!.id, version: 1 }).select('version');
    if (error) throw error;
    if (!changed?.length) return json({ error: 'Conflito de atualização. Recarregue a base e tente novamente.' }, 409);
    return json({ version: changed[0].version, storage: 'supabase', importedAt: new Date().toISOString() });
  } catch (error) {
    console.error('ARP persistence error', error instanceof Error ? error.name : 'database');
    return json({ error: 'Falha na persistência. A base ativa anterior foi preservada.' }, 500);
  }
});
