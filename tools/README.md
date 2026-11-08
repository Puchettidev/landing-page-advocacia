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
