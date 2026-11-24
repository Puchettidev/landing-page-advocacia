# Artigos jurídicos — guia de uso, implantação e manutenção

Seção `/artigos/` do site **www.alexandrecampospuchetti.com.br**, com painel de publicação em `/admin/`.

## 1. Como funciona

```
Painel /admin (Decap CMS)  ──commit──▶  GitHub (content/artigos/*.json)  ──▶  Vercel: npm ci + node tools/build.mjs --dist
        ▲                                                                              │
   login GitHub (OAuth via /api/auth e /api/callback)                    HTML estático em /dist (artigos, sitemap, robots)
```

- Cada artigo é um arquivo `content/artigos/<nome>.json`; as categorias ficam em `content/categorias.json`.
- Cada salvamento no painel gera um **commit** no repositório (histórico completo = backup e recuperação).
- A Vercel recompila o site a cada commit. O HTML dos artigos é gerado no servidor de build — o Google lê o texto integral sem depender de JavaScript.
- Rascunhos **nunca** são publicados: não geram página, não entram no sitemap e a pasta `content/` não vai para o site.

## 2. Configuração na Vercel (uma única vez)

### 2.1 Criar o OAuth App no GitHub
GitHub → *Settings* → *Developer settings* → *OAuth Apps* → *New OAuth App*:
- **Homepage URL:** `https://www.alexandrecampospuchetti.com.br`
- **Authorization callback URL:** `https://www.alexandrecampospuchetti.com.br/api/callback`

Gere um *Client secret*.

### 2.2 Variáveis de ambiente (Vercel → Project → Settings → Environment Variables, ambiente *Production*)

| Variável | Obrigatória | Valor |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | sim | Client ID do OAuth App |
| `GITHUB_CLIENT_SECRET` | sim | Client secret do OAuth App |
| `ADMIN_GITHUB_USERS` | recomendada | Usuários do GitHub autorizados, separados por vírgula |
| `GITHUB_SCOPE` | não | `repo` (padrão, repositório privado) ou `public_repo` (repositório público) |
| `GA_MEASUREMENT_ID` | não | ID do GA4 (`G-XXXXXXXXXX`). Sem ele, nada de Analytics é carregado |
| `CRON_SECRET` | para agendamento | Texto aleatório longo (a Vercel o envia ao cron) |
| `VERCEL_DEPLOY_HOOK_URL` | para agendamento | Vercel → Settings → Git → *Deploy Hooks* → criar hook da branch `main` |

Nenhuma senha ou chave fica no código-fonte.

### 2.3 Build
O arquivo `vercel.json` já define: instalação (`npm ci --prefix tools`), build (`node tools/build.mjs --dist`), pasta publicada (`dist`), cabeçalhos de segurança/cache e o cron diário de publicações agendadas. Se o painel da Vercel tiver *Build/Output* personalizados, deixe-os em branco (o `vercel.json` prevalece).

### 2.4 Acesso ao painel
Quem edita precisa de uma conta no GitHub com permissão de escrita no repositório (*Settings → Collaborators*) e, se `ADMIN_GITHUB_USERS` estiver definida, estar na lista. Ative a **verificação em duas etapas** no GitHub: a proteção contra tentativas repetidas de login e o gerenciamento da sessão de login são feitos pelo GitHub.

## 3. Publicar um artigo (passo a passo)

1. Acesse `https://www.alexandrecampospuchetti.com.br/admin/` e clique em **Entrar com o GitHub**.
2. **Artigos → Novo Artigo**.
3. Preencha: título, endereço (ex.: `alongamento-de-dividas-rurais`), categoria, breve descrição, autor e data.
4. Escreva o conteúdo: use **Título 2** para as seções e **Título 3** para subseções (o sumário é automático). Negrito, itálico, listas, citações, links, imagens e tabelas estão na barra do editor (o botão **+** insere imagem ou tabela).
5. Imagem de capa: envie JPG/PNG/WebP (de preferência 1600 px de largura) e descreva-a no campo de texto alternativo.
6. Referências: inclua somente legislação e jurisprudência conferidas.
7. SEO (opcional): meta title, meta description e imagem para redes sociais.
8. Confira a **prévia** à direita da tela.
9. **Status → Publicado** e clique em **Publicar → Publicar agora**. Em 1 a 2 minutos o artigo está no ar, na listagem e no sitemap.

- **Salvar como rascunho:** deixe o status em *Rascunho* e salve.
- **Agendar:** status *Publicado* com data futura. O cron verifica diariamente (por volta das 6h, horário de Brasília) e publica.
- **Despublicar:** volte o status para *Rascunho* e salve — a página sai do ar e do sitemap.
- **Excluir:** *Excluir entrada* (o painel pede confirmação). O arquivo continua no histórico do GitHub, se for preciso recuperar.
- **Atualizar:** edite e preencha *Data da última atualização* quando a mudança for relevante (vai para o Google e o `lastmod` do sitemap).
- **Alterar o endereço de um artigo publicado:** evite. Se for indispensável, informe o endereço antigo em *Endereços antigos*: ele passa a redirecionar para o novo (redirecionamento imediato, tratado pelo Google como permanente). Para um 301 de servidor, acrescente também em `vercel.json`:
  `"redirects": [{ "source": "/artigos/antigo/", "destination": "/artigos/novo/", "permanent": true }]`
- **Categorias:** menu *Categorias* do painel (nome, identificador e página de atuação vinculada).

## 4. Rascunhos iniciais
Dez temas foram criados como **rascunho**, com a estrutura de tópicos e marcações `[A ser elaborado e revisado pelo advogado responsável…]`. Não contêm legislação, jurisprudência ou dados inventados. A verificação automática (`npm run check`) acusa erro se algum texto com essa marcação for publicado.

## 5. Uso local (desenvolvedor)

```bash
cd tools
npm install            # primeira vez
npm run build          # gera as páginas na raiz (rascunhos não entram)
npm run build:drafts   # prévia local COM rascunhos (noindex; não publicar)
npm run serve          # http://localhost:5173  (painel: /admin/)
npm run cms            # servidor local do painel (grava direto em content/, sem GitHub)
npm run build:dist     # pacote igual ao da Vercel em /dist
npm run check          # verifica links, sitemap, canonical, JSON-LD, H1, alt e rascunhos em /dist
```

## 6. SEO e indexação
- Página de cada artigo: H1 único, meta title/description, canonical absoluto, Open Graph/Twitter, `article:published_time`/`modified_time`, JSON-LD `BlogPosting` (autor com OAB, editor, datas, seção, contagem de palavras) e `BreadcrumbList`.
- Listagem: `CollectionPage` + `ItemList`; filtros por `?categoria=` mantêm o canonical em `/artigos/` (sem conteúdo duplicado). Paginação estática `/artigos/pagina/N/` (9 por página) quando necessário.
- Enquanto não houver artigo publicado, `/artigos/` fica com `noindex` e fora do sitemap (evita página vazia indexada).
- `sitemap.xml`: só URLs públicas, canônicas e indexáveis; `lastmod` real (data de atualização/publicação; páginas fixas usam `PAGES_LASTMOD` em `tools/site-data.mjs`).
- `robots.txt`: bloqueia `/admin/` e `/api/`; o painel também envia `noindex`.
- URLs existentes não foram alteradas. Após o primeiro artigo publicado, reenviar o sitemap no Search Console é opcional (o Google o relê periodicamente).

## 7. Analytics (GA4) e LGPD
Ativado somente com `GA_MEASUREMENT_ID`. O script do Google é carregado **apenas após o aceite** no aviso de cookies; a escolha pode ser alterada em *Preferências de cookies* (rodapé). Sinais de anúncios desativados.

Eventos: `article_view`, `article_read_complete`, `article_area_click`, `article_search` (sem o termo), `article_filter`, `share_click`, `whatsapp_click`, `phone_click`, `contact_form_whatsapp_submit` (apenas a área), `form_step`, `faq_open`, `faq_search` (sem o termo). Nenhum nome, telefone, e-mail, texto digitado ou relato de caso é enviado. Para conversões, marque `whatsapp_click`, `phone_click` e `contact_form_whatsapp_submit` como *eventos-chave* no GA4.

## 8. Manutenção
- Revise periodicamente a versão do Decap CMS em `admin/index.html` (a URL tem versão fixa e hash de integridade SRI; ao atualizar, recalcule o hash).
- `npm audit` em `tools/` antes de atualizar dependências (`marked` e `sharp`).
- Imagens: o build gera AVIF/WebP/JPG em `assets/uploads/_otim/` (não versionado).
- Conferir no Search Console (*Páginas* e *Sitemaps*) após as primeiras publicações.
