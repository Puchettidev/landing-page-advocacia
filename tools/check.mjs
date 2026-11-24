// Verificação do pacote de publicação (/dist). Uso: npm run build:dist && npm run check
// Confere: links e recursos internos, sitemap (URLs existentes, canônicas e indexáveis),
// canonical de cada página, JSON-LD válido, um único H1, alt nas imagens e ausência de rascunhos.
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "./site-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const errors = [];
const warn = [];
const fail = (m) => errors.push(m);

async function walk(dir) {
    const out = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...(await walk(p)));
        else out.push(p);
    }
    return out;
}
const exists = async (p) => stat(p).then(() => true, () => false);
const rel = (f) => path.relative(dist, f).split(path.sep).join("/");
const urlOf = (r) => `${SITE.url}/${r === "index.html" ? "" : r.replace(/(^|\/)index\.html$/, "$1")}`;

function resolveLocal(fromRel, href) {
    const clean = href.split("#")[0].split("?")[0];
    if (!clean) return null;
    const base = clean.startsWith("/") ? clean.slice(1) : path.posix.join(path.posix.dirname(fromRel), clean);
    return base.endsWith("/") || base === "" ? `${base}index.html` : base;
}

const files = await walk(dist);
const htmlFiles = files.filter((f) => f.endsWith(".html") && !rel(f).startsWith("admin/"));
const pages = new Map();

for (const f of htmlFiles) {
    const r = rel(f);
    const html = await readFile(f, "utf8");
    const robots = html.match(/<meta name="robots" content="([^"]+)"/)?.[1] || "";
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || "";
    const isRedirect = html.includes('http-equiv="refresh"');
    pages.set(r, { robots, canonical, isRedirect });

    if (!canonical) fail(`${r}: sem canonical`);
    else if (!isRedirect && canonical !== urlOf(r)) fail(`${r}: canonical ${canonical} difere de ${urlOf(r)}`);
    if (isRedirect) continue;

    const h1 = (html.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) fail(`${r}: ${h1} elementos H1`);
    if (!/<title>[^<]{10,}<\/title>/.test(html)) fail(`${r}: title ausente ou curto`);
    if (!/<meta name="description" content="[^"]+"/.test(html)) fail(`${r}: sem meta description`);
    else if (!/<meta name="description" content="[^"]{70,}"/.test(html)) warn.push(`${r}: meta description curta (ideal: 120 a 160 caracteres)`);
    for (const m of html.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/g)) fail(`${r}: imagem sem alt: ${m[0].slice(0, 80)}`);
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        try {
            const j = JSON.parse(m[1]);
            if (!j["@context"] || !j["@type"]) fail(`${r}: JSON-LD sem @context/@type`);
        } catch (e) {
            fail(`${r}: JSON-LD inválido (${e.message})`);
        }
    }
    if (/\[A ser elaborado/.test(html)) fail(`${r}: contém texto de rascunho`);
    if (/Prévia — /.test(html)) fail(`${r}: contém marcação de prévia`);

    for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
        const href = m[1];
        if (/^(https?:|mailto:|tel:|data:|#|\/\/)/.test(href)) continue;
        const target = resolveLocal(r, href);
        if (target && !(await exists(path.join(dist, target)))) fail(`${r}: link quebrado -> ${href}`);
    }
    for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) {
        for (const part of m[1].split(",")) {
            const u = part.trim().split(/\s+/)[0];
            if (/^https?:/.test(u)) continue;
            const target = resolveLocal(r, u);
            if (target && !(await exists(path.join(dist, target)))) fail(`${r}: srcset quebrado -> ${u}`);
        }
    }
}

// Sitemap
const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const lastmods = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
if (locs.length !== lastmods.length) fail("sitemap: <lastmod> ausente em alguma URL");
for (const d of lastmods) if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) fail(`sitemap: lastmod inválido ${d}`);
if (new Set(locs).size !== locs.length) fail("sitemap: URLs duplicadas");
for (const loc of locs) {
    if (!loc.startsWith(`${SITE.url}/`)) fail(`sitemap: domínio incorreto ${loc}`);
    const r = loc.slice(SITE.url.length + 1);
    const file = r === "" ? "index.html" : r.endsWith("/") ? `${r}index.html` : r;
    const p = pages.get(file);
    if (!p) fail(`sitemap: URL sem página ${loc}`);
    else {
        if (p.robots.includes("noindex")) fail(`sitemap: URL com noindex ${loc}`);
        if (p.canonical !== loc) fail(`sitemap: URL não canônica ${loc}`);
    }
}
for (const [r, p] of pages) {
    if (!p.isRedirect && !p.robots.includes("noindex") && !locs.includes(urlOf(r)) && !/\/pagina\/\d+\//.test(r)) warn.push(`fora do sitemap (indexável): ${r}`);
}

// Robots e arquivos que não podem ser publicados
const robots = await readFile(path.join(dist, "robots.txt"), "utf8");
if (!robots.includes("Disallow: /admin/")) fail("robots.txt: /admin/ não bloqueado");
if (!robots.includes(`Sitemap: ${SITE.url}/sitemap.xml`)) fail("robots.txt: sem Sitemap");
for (const forbidden of ["content", "tools", "api", ".env"]) if (await exists(path.join(dist, forbidden))) fail(`/dist contém ${forbidden}`);
const admin = await readFile(path.join(dist, "admin/index.html"), "utf8");
if (!admin.includes('content="noindex, nofollow"')) fail("admin sem noindex");

console.log(`Páginas HTML verificadas: ${htmlFiles.length} · URLs no sitemap: ${locs.length}`);
for (const w of warn) console.log(` aviso: ${w}`);
if (errors.length) {
    for (const e of errors) console.error(` ERRO: ${e}`);
    console.error(`${errors.length} erro(s).`);
    process.exit(1);
}
console.log("Nenhum erro encontrado.");
