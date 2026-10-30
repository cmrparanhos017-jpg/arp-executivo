# ARP · Dashboard Executivo de Pregões e Saldos

Aplicação Next.js / React / Tailwind CSS com Lucide Icons, importação Excel/HTML, exportação SheetJS, PDF executivo e persistência real no Supabase.

## Usar

1. Abra o endereço de produção e entre com o e-mail e a senha cadastrados pelo seu convite. A aplicação valida a identidade no Supabase Auth e o perfil no servidor.
2. Use a busca global ou os filtros. Os indicadores, gráficos e atas acompanham o filtro atual.
3. Expanda uma ata para selecionar itens e consultar os saldos. Clique na descrição ou na lupa para ver todas as 26 colunas, os links e todos os arquivos.
4. A seleção permanece ativa ao mudar de página ou de filtro. O painel informa quantos itens selecionados estão fora da visualização. O PDF usa a seleção enquanto houver itens selecionados.
5. Em “Importar planilha”, confira a prévia e escolha sincronizar com o Supabase ou salvar apenas no navegador. A importação troca a base ativa inteira; não faz merge parcial.

## Fonte real e controles

Fonte: `29OUT - COMPRAS - ARP - GESTAO ARP.xls`, arquivo HTML com extensão XLS fornecido pelo usuário.

- 26 colunas, preservadas com seus cabeçalhos originais.
- 2.121 itens; 399 grupos de atas; 38 compras; 325 CNPJs de fornecedores.
- Total homologado: R$ 69.187.343,95.
- Consumo calculado: R$ 65.353.788,18.
- Disponível: R$ 3.833.555,77.
- Normal: 271 itens; crítico: 1.695; esgotado: 155.
- SHA-256 do arquivo: `8eaa69c5a3ff0e9c26b870854d4742b66aa8a9222d3f330d48931f7141689935`.

O snapshot local `data/initial-dataset.json` contém exclusivamente as células reais. Nenhum registro fictício é usado. Este snapshot acompanha apenas a entrega local; não foi incluído no código publicado na Vercel. A aplicação publicada consulta os dados no Supabase.

## Interpretação dos cálculos

- Quantidade consumida calculada = QTD HOMOLOGADA − QTD DISPONÍVEL.
- Homologado = QTD HOMOLOGADA × VALOR UNITÁRIO.
- Consumo calculado = (QTD HOMOLOGADA − QTD DISPONÍVEL) × VALOR UNITÁRIO.
- Disponível = QTD DISPONÍVEL × VALOR UNITÁRIO.
- Consumo quantitativo = quantidade consumida / homologada. Homologada zero: não aplicável.
- Consumo financeiro agregado = soma dos valores consumidos / soma dos valores homologados. Não é média simples dos percentuais.

A diferença das quantidades não comprova emissão de empenhos. QTD HOMOLOGADA e QTD REGISTRADA são campos diferentes e permanecem separados. Quantidades agregadas podem misturar unidades; o panorama executivo usa valores financeiros. Saldo positivo não comprova vigência: aplique o filtro “Vigentes hoje” quando necessário.

A chave de agrupamento é UG + UGG + NOME UGG + Nº ATA + ANO ATA. O filtro Compra / pregão consolida todas as atas da compra selecionada nos indicadores. Identificadores mantêm os zeros à esquerda. Valores são calculados com decimal.js (40 dígitos de precisão) e apresentados em reais. O Excel mantém uma aba “Originais” e fórmulas recalculáveis na aba “Itens”. O PDF é um relatório executivo consolidado por ata; o detalhamento completo fica no Excel.

## Rodar no computador

Requer Node.js 22 ou superior; projeto validado com Node.js 24.

```bash
npm ci
```

Configure `ARP_CLOUD_ENDPOINT` e `ARP_CLOUD_TOKEN` em `.env.local` para usar os endpoints autenticados. A base local de referência é usada pelos testes; não a publique no repositório.

```bash
npm run dev
```

Abra `http://localhost:3000`. A importação suporta .xlsx, .xls (inclusive HTML) e .csv, até 20 MB. O limite do conteúdo extraído enviado ao servidor é 3,8 MB ou 25.000 itens; arquivos maiores devem ser divididos.

```bash
npm test
npm run typecheck
npm run build
npm start
```

## Código principal em arquivo único

`DashboardARP.tsx` reúne a interface, o motor de cálculo, o parser, as exportações e os estilos do componente em um arquivo. Para usá-lo, importe-o em uma página de um projeto React/Next com as dependências deste `package.json` e Tailwind configurado. A rota `/api/dataset` continua necessária para sincronização segura. O componente não contém credenciais de servidor nem dados embutidos.

A versão usada na aplicação organiza a implementação por responsabilidade:

- `app/dashboard.tsx`: interface e fluxo de interação.
- `lib/arp.ts`: mapeamento, parser, filtros, agrupamentos e cálculos.
- `lib/export.ts`: Excel e PDF.
- `app/api/dataset/route.ts`: conexão protegida de servidor.
- `app/globals.css`: Tailwind e sistema visual responsivo.
- `supabase/schema.sql`: esquema consolidado do banco.
- `supabase/functions/arp-dataset/index.ts`: persistência e controle de concorrência.

## Supabase e acesso

O projeto `arp-executivo` foi criado na região de São Paulo. As tabelas `arp_datasets` e `arp_workspace` têm RLS ativo e não concedem acesso a anon/authenticated. A Edge Function valida uma chave de integração de 256 bits; apenas o hash está no código. A chave original fica nas variáveis criptografadas da Vercel, sem prefixo NEXT_PUBLIC. A service_role é usada apenas no ambiente de servidor da função.

Cada importação cria ou reutiliza um snapshot imutável e atualiza o ponteiro da base por comparação de versão. Se outra sessão atualizar a base, o servidor retorna 409 e preserva a versão ativa. Os snapshots anteriores permanecem no banco; restauração por interface não foi adicionada.

A aplicação usa Supabase Auth com acesso por convite e cookies HttpOnly, Secure em produção e SameSite=Strict. A autorização consulta `arp_members` no servidor a cada operação, permitindo revogação imediata. Visitantes podem consultar, filtrar, selecionar e exportar. Somente administradores importam ou gerenciam acessos. A proteção da Vercel pode ser substituída pelo login da aplicação somente depois de verificar os bloqueios de API, para que convidados não precisem de conta Vercel. Não publique `.env.local`.

As variáveis `ARP_CLOUD_ENDPOINT` e `ARP_CLOUD_TOKEN` já foram configuradas no projeto Vercel criado durante esta entrega. Seus valores secretos não acompanham o ZIP. Para outra implantação, configure uma nova chave forte de integração e defina seu SHA-256 como `ARP_TOKEN_SHA256` nos secrets da Edge Function; use a chave original apenas no ambiente do servidor Next.

## GitHub

A conexão consultada não retornou repositórios disponíveis, e o conector não oferece criação de repositório. O projeto foi entregue pronto para inclusão em um repositório privado. Exclua `data/` se a política do repositório não permitir armazenar o snapshot institucional; o código publicado na Vercel já funciona sem ele. Preserve as exclusões de `.gitignore`. Para implantação contínua, conecte o repositório ao projeto Vercel após criá-lo.

## Validação realizada

- Reconciliação das 2.121 linhas e das 26 células de cada linha.
- Totais decimais independentes e conferência dos grupos/fornecedores.
- Busca e filtros com dados reais.
- Excel completo, tipos numéricos, datas, fórmulas e round-trip das células originais.
- PDF executivo real com paginação.
- TypeScript e build de produção.
- Revisão visual em desktop e quadros estáticos responsivos de 375 / 768 px; valores monetários sem transbordamento nos cards.
- Supabase: leitura idêntica à origem, rejeição de acesso sem chave (401), rejeição de versão obsoleta (409), sem avisos no verificador de segurança.
- Navegador: busca, acordeões, seleção, geração Excel/PDF e importação do arquivo original.

### Verificação da implantação

A implantação de produção está READY. Em 29/10/2026, a leitura de `/api/dataset` pela aplicação publicada na Vercel retornou HTTP 200, com armazenamento Supabase e versão 1. As 2.121 linhas e 26 colunas recebidas foram comparadas à planilha original: todas as células e o hash de conteúdo correspondem à origem. Foram reconfirmados 399 grupos de atas, 38 compras, 325 fornecedores e os totais de R$ 69.187.343,95 homologados, R$ 65.353.788,18 de consumo calculado e R$ 3.833.555,77 disponíveis. A interface, o importador e as exportações foram verificados localmente com o arquivo original; esta verificação em produção cobriu a leitura e a integridade dos dados.


## Melhorias de consulta e compartilhamento

- Aba Pregões: UGG + número/ano da compra → atas → itens. Usa as mesmas seleções, filtros e totais decimais.
- Objeto e endereço de origem consultados na API oficial do PNCP; valida UGG, número e ano. Metadados ficam separados da planilha e são armazenados em cache por até 24 horas. Falhas e divergências são exibidas sem completar dados.
- Links legados da família `/transparencia/arpshow/` foram mantidos nas células originais. O botão de acesso usa a compra no PNCP, onde o visitante localiza o número do item; a aba Pregões oferece o link Compras.gov informado oficialmente pelo PNCP.
- Texto ampliado e contraste reforçado, sem remover o tema escuro.
- Guia de seis passos e perguntas frequentes em Como usar.
- Na Central de dados, o administrador informa um e-mail e gera um convite pessoal. O envio é manual: copie e compartilhe o link de uso único (24 horas). Não há disparo automático de e-mails. O convidado define uma senha; não há cadastro público. Para revogar ou reativar um acesso, use a lista de pessoas na mesma seção.
- A Edge Function `arp-access` valida a chave de integração antes de qualquer ação. A service_role permanece somente no Supabase. O cliente de autenticação é separado do cliente administrativo para que login e refresh não alterem os privilégios das consultas de autorização.
