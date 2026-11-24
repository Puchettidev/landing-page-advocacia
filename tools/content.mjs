// Artigos jurídicos: leitura e validação do conteúdo salvo pelo painel (/admin),
// conversão segura de Markdown em HTML e otimização das imagens enviadas.
import { readFile, readdir, stat, mkdir } from "node:fs/promises";
import path from "node:path";
import { Marked } from "marked";

export const CONTENT_DIR = "content";
export const UPLOADS_PUBLIC = "/assets/uploads";
const OPT_DIR = "assets/uploads/_otim"; // gerado no build (não versionado)
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function slugify(s) {
    return String(s ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 90)
        .replace(/-+$/g, "");
}

const strip = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

// ---------- Markdown seguro ----------
// HTML bruto é sempre exibido como texto (proteção contra XSS) e só são aceitos
// links http(s), mailto, tel, âncoras e caminhos internos.
function safeHref(href) {
    const h = String(href ?? "").trim();
    if (/^(https?:|mailto:|tel:)/i.test(h)) return h;
    if (/^[#/]/.test(h) && !h.startsWith("//")) return h;
    if (/^[a-z0-9][\w\-./]*(#[\w-]*)?$/i.test(h) && !h.includes(":")) return h;
    return "";
}

export function createRenderer({ siteUrl, areaSlugs, imageHtml }) {
    return function render(markdown) {
        const headings = [];
        const used = new Set();
        const areaLinks = new Set();
        const marked = new Marked({ gfm: true, breaks: false });
        marked.use({
            renderer: {
                html({ text }) {
                    return esc(text);
                },
                heading({ tokens, depth }) {
                    const inner = this.parser.parseInline(tokens);
                    const plain = inner.replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/gi, " ");
                    const level = Math.min(Math.max(depth, 2), 4); // o H1 é o título do artigo
                    let id = slugify(plain) || "secao";
                    while (used.has(id)) id += "-2";
                    used.add(id);
                    if (level <= 3) headings.push({ id, text: strip(plain), level });
                    return `<h${level} id="${id}">${inner}</h${level}>\n`;
                },
                link({ href, title, tokens }) {
                    const inner = this.parser.parseInline(tokens);
                    const url = safeHref(href);
                    if (!url) return inner;
                    const external = /^https?:/i.test(url) && !url.startsWith(siteUrl);
                    const local = url.replace(siteUrl, "").replace(/^\//, "").split("#")[0];
                    const area = areaSlugs.find((s) => local === `${s}.html`);
                    if (area) areaLinks.add(area);
                    return `<a href="${esc(url)}"${title ? ` title="${esc(title)}"` : ""}${external ? ' target="_blank" rel="noopener noreferrer"' : ""}${area ? ` data-area-link="${area}"` : ""}>${inner}</a>`;
                },
                image({ href, title, text }) {
                    return imageHtml(href, text, title);
                },
                table(token) {
                    const cell = (c, tag) => `<${tag}${c.align ? ` style="text-align:${c.align}"` : ""}>${this.parser.parseInline(c.tokens)}</${tag}>`;
                    const head = `<tr>${token.header.map((c) => cell(c, "th")).join("")}</tr>`;
                    const body = token.rows.map((r) => `<tr>${r.map((c) => cell(c, "td")).join("")}</tr>`).join("");
                    return `<div class="table-wrap" tabindex="0" role="region" aria-label="Tabela"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>\n`;
                },
            },
        });
        const html = marked.parse(String(markdown ?? ""));
        const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
        const words = text.split(/\s+/).filter(Boolean).length;
        return { html, headings, words, areaLinks: [...areaLinks] };
    };
}

// ---------- Imagens ----------
let sharpModule;
async function getSharp() {
    if (sharpModule === undefined) {
        try {
            sharpModule = (await import("sharp")).default;
        } catch {
            sharpModule = null;
            console.warn("[artigos] sharp indisponível: imagens serão usadas sem otimização.");
        }
    }
    return sharpModule;
}

/**
 * Valida uma imagem enviada pelo painel e gera versões AVIF/WebP/JPG responsivas.
 * Retorna null quando o arquivo é inválido (extensão, tamanho ou conteúdo).
 */
export async function prepareImage(root, publicPath, widths = [480, 800, 1200], warnings = []) {
    if (!publicPath) return null;
    const clean = String(publicPath).split(/[?#]/)[0];
    if (/^https?:/i.test(clean)) {
        warnings.push(`Imagem externa ignorada (envie pelo painel): ${clean}`);
        return null;
    }
    const rel = clean.replace(/^\/+/, "");
    const ext = path.extname(rel).toLowerCase();
    const file = path.join(root, rel);
    if (!file.startsWith(path.join(root, "assets", "uploads")) || !IMAGE_EXT.has(ext)) {
        warnings.push(`Imagem recusada (use JPG, PNG, WebP, AVIF ou GIF em ${UPLOADS_PUBLIC}): ${clean}`);
        return null;
    }
    let info;
    try {
        info = await stat(file);
    } catch {
        warnings.push(`Imagem não encontrada: ${clean}`);
        return null;
    }
    if (info.size > MAX_IMAGE_BYTES) {
        warnings.push(`Imagem acima de 15 MB recusada: ${clean}`);
        return null;
    }
    const sharp = await getSharp();
    const original = { src: `/${rel}`, width: null, height: null, sources: [], fallback: `/${rel}`, srcset: "" };
    if (!sharp) return original;
    let meta;
    try {
        meta = await sharp(file).metadata();
    } catch {
        warnings.push(`Arquivo não é uma imagem válida: ${clean}`);
        return null;
    }
    if (ext === ".gif") return { ...original, width: meta.width, height: meta.height };
    const base = path.basename(rel, ext).replace(/[^\w-]+/g, "-");
    const outDir = path.join(root, OPT_DIR);
    await mkdir(outDir, { recursive: true });
    const ws = [...new Set(widths.map((w) => Math.min(w, meta.width)))].sort((a, b) => a - b);
    const formats = { avif: (p) => p.avif({ quality: 52, effort: 4 }), webp: (p) => p.webp({ quality: 74 }), jpg: (p) => p.jpeg({ quality: 78, mozjpeg: true, progressive: true }) };
    for (const w of ws) {
        for (const [fmt, apply] of Object.entries(formats)) {
            const out = path.join(outDir, `${base}-${w}.${fmt}`);
            try {
                const o = await stat(out);
                if (o.mtimeMs >= info.mtimeMs) continue;
            } catch {
                /* ainda não existe */
            }
            await apply(sharp(file).rotate().resize({ width: w, withoutEnlargement: true })).toFile(out);
        }
    }
    const url = (w, fmt) => `/${OPT_DIR}/${base}-${w}.${fmt}`;
    const set = (fmt) => ws.map((w) => `${url(w, fmt)} ${w}w`).join(", ");
    const fbW = ws[Math.min(1, ws.length - 1)];
    return {
        src: `/${rel}`,
        width: fbW,
        height: Math.round((meta.height / meta.width) * fbW),
        sources: [
            { type: "image/avif", srcset: set("avif") },
            { type: "image/webp", srcset: set("webp") },
        ],
        fallback: url(fbW, "jpg"),
        srcset: set("jpg"),
        large: url(ws.at(-1), "jpg"),
        largeWidth: ws.at(-1),
        largeHeight: Math.round((meta.height / meta.width) * ws.at(-1)),
        thumb: url(ws[0], "webp"),
    };
}

export function pictureHtml(img, { alt = "", sizes = "100vw", eager = false, cls = "" } = {}) {
    if (!img) return "";
    const dims = img.width ? ` width="${img.width}" height="${img.height}"` : "";
    const sources = img.sources.map((s) => `<source type="${s.type}" srcset="${s.srcset}" sizes="${sizes}">`).join("");
    const srcset = img.srcset ? ` srcset="${img.srcset}" sizes="${sizes}"` : "";
    const loading = eager ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"';
    return `<picture${cls ? ` class="${cls}"` : ""}>${sources}<img src="${img.fallback}"${srcset}${dims} alt="${esc(alt)}"${loading}></picture>`;
}

// ---------- Leitura e validação ----------
export async function loadCategories(root) {
    const raw = JSON.parse(await readFile(path.join(root, CONTENT_DIR, "categorias.json"), "utf8"));
    const list = (raw.categorias || [])
        .map((c) => ({ nome: strip(c.nome), slug: slugify(c.slug || c.nome), descricao: strip(c.descricao), area: c.area || "" }))
        .filter((c) => c.nome && c.slug);
    return list;
}

/**
 * Lê todos os artigos. Retorna { published, drafts, scheduled, warnings }.
 * - published: status "publicado" e data de publicação já alcançada;
 * - scheduled: status "publicado" com data futura (publicados por um novo build);
 * - drafts: status "rascunho".
 */
export async function loadArticles(root, { now = new Date(), categories }) {
    const dir = path.join(root, CONTENT_DIR, "artigos");
    let files = [];
    try {
        files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
    } catch {
        /* sem artigos */
    }
    const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));
    const warnings = [];
    const all = [];
    const seen = new Map();
    for (const f of files) {
        let a;
        try {
            a = JSON.parse(await readFile(path.join(dir, f), "utf8"));
        } catch (e) {
            warnings.push(`${f}: JSON inválido (${e.message}) — artigo ignorado.`);
            continue;
        }
        const titulo = strip(a.titulo);
        const slug = slugify(a.slug || titulo);
        if (!titulo || !slug) {
            warnings.push(`${f}: sem título — artigo ignorado.`);
            continue;
        }
        if (a.slug && !SLUG_RE.test(a.slug)) warnings.push(`${f}: endereço "${a.slug}" ajustado para "${slug}".`);
        if (seen.has(slug)) {
            warnings.push(`${f}: endereço "${slug}" já usado por ${seen.get(slug)} — artigo ignorado.`);
            continue;
        }
        seen.set(slug, f);
        const published = parseDate(a.publicado_em);
        const updated = parseDate(a.atualizado_em);
        const status = a.status === "publicado" ? "publicado" : "rascunho";
        const category = catBySlug[a.categoria] || null;
        if (!category) warnings.push(`${f}: categoria "${a.categoria}" não encontrada.`);
        if (status === "publicado" && !published) warnings.push(`${f}: publicado sem data de publicação — mantido como rascunho.`);
        const seo = a.seo || {};
        all.push({
            file: f,
            titulo,
            slug,
            status: status === "publicado" && published ? "publicado" : "rascunho",
            category,
            resumo: strip(a.resumo),
            autor: strip(a.autor) || "",
            published,
            updated: updated && published && updated > published ? updated : null,
            capa: a.capa || "",
            capaAlt: strip(a.capa_alt),
            destaque: Boolean(a.destaque),
            corpo: String(a.corpo ?? ""),
            referencias: (a.referencias || []).map((r) => (typeof r === "string" ? { texto: strip(r), link: "" } : { texto: strip(r.texto), link: safeHref(r.link || "") })).filter((r) => r.texto),
            areas: (a.areas_relacionadas || []).filter(Boolean),
            seoTitle: strip(seo.titulo),
            seoDescription: strip(seo.descricao),
            socialImage: seo.imagem_social || "",
            indexable: seo.indexar !== false,
            oldSlugs: (a.enderecos_antigos || []).map((s) => slugify(typeof s === "string" ? s : s?.endereco)).filter((s) => s && s !== slug),
        });
    }
    const byDate = (x, y) => (y.published?.getTime() || 0) - (x.published?.getTime() || 0) || x.titulo.localeCompare(y.titulo, "pt-BR");
    const published = all.filter((a) => a.status === "publicado" && a.published <= now).sort(byDate);
    const scheduled = all.filter((a) => a.status === "publicado" && a.published > now).sort(byDate);
    const drafts = all.filter((a) => a.status === "rascunho").sort(byDate);
    return { published, scheduled, drafts, warnings };
}

export function readingMinutes(words) {
    return Math.max(1, Math.round(words / 200));
}

const TZ = "America/Sao_Paulo";
export function formatDate(d) {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(d);
}
export function isoDate(d) {
    // AAAA-MM-DD no fuso de Brasília
    return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
