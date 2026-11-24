# Ferramentas do site (uso local)

O site publicado continua 100% estático (HTML/CSS/JS na raiz). Esta pasta só gera os arquivos.

| Arquivo | Função |
| --- | --- |
| `site-data.mjs` | **Todo o conteúdo** (textos, áreas, FAQ, contatos). Edite aqui. |
| `build.mjs` | Gera as 13 páginas `.html`, o `sitemap.xml`, os fundos topográficos e versiona CSS/JS. |
| `images.mjs` | Converte as fotos de `/imagem` em AVIF/WebP/JPG responsivos em `/assets/img`. |
| `favicons.mjs` | Gera favicon.ico, ícones PNG, apple-touch-icon e site.webmanifest a partir do logotipo. |
| `icons.mjs` | Ícones SVG de linha usados nas páginas. |
| `serve.mjs` | Servidor local para testar. |

## Comandos

```bash
cd tools
npm install        # só na primeira vez (instala o sharp, usado para imagens)
npm run images     # quando trocar/adicionar fotos em /imagem
npm run build      # sempre que mudar textos, CSS ou JS
npm run serve      # abre em http://localhost:5173
```

> Não edite os `.html` da raiz à mão: eles são sobrescritos pelo `npm run build`.

## Artigos jurídicos

| Arquivo | Função |
| --- | --- |
| `content.mjs` | Lê e valida `content/artigos/*.json`, converte Markdown com segurança e otimiza imagens. |
| `check.mjs` | Verifica o pacote `/dist` (links, sitemap, canonical, JSON-LD, H1, alt, rascunhos). |

```bash
npm run build:drafts   # prévia local com rascunhos (noindex)
npm run build:dist     # pacote de publicação em /dist (o mesmo comando roda na Vercel)
npm run check          # validação do /dist
npm run cms            # servidor local do painel /admin
```

Guia completo (painel, publicação, Vercel, SEO, GA4): [`docs/ARTIGOS.md`](../docs/ARTIGOS.md).
