// Gera as páginas HTML estáticas do site a partir de site-data.mjs.
// Uso: cd tools && npm run build
//   --drafts  inclui rascunhos e agendados (somente para prévia local; páginas com noindex)
//   --dist    copia apenas os arquivos públicos para /dist (usado no build da Vercel)
import { readFile, writeFile, mkdir, rm, cp, readdir as readDir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, AREAS, FAQ, FAQ_CATEGORIES, VALUES, STEPS_HOME, STEPS_ABOUT, GUIDANCE, GALLERY, DIFFERENTIALS, LEGAL_PAGES, PAGES_LASTMOD } from "./site-data.mjs";
import { icon, WHATSAPP_SVG, CATEGORY_ICONS } from "./icons.mjs";
import { loadCategories, loadArticles, createRenderer, prepareImage, pictureHtml, readingMinutes, formatDate, isoDate } from "./content.mjs";
import { Marked } from "marked";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "assets/img/manifest.json"), "utf8"));
const ARGS = new Set(process.argv.slice(2));
const WITH_DRAFTS = ARGS.has("--drafts");
const NOW = new Date();
// ID de mensuração do GA4: definido por variável de ambiente (Vercel → Settings → Environment Variables).
const GA_ID = (() => {
    const id = String(process.env.GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GA_ID || "").trim();
    if (!id) return "";
    if (!/^G-[A-Z0-9]{4,20}$/.test(id)) throw new Error(`GA_MEASUREMENT_ID inválido: "${id}" (formato esperado: G-XXXXXXXXXX)`);
    return id;
})();

// Versão = hash do conteúdo de CSS/JS (muda só quando algo muda de fato).
const { createHash } = await import("node:crypto");
const { readdir: listDir } = await import("node:fs/promises");
const assetSources = [
    path.join(root, "assets/css/main.css"),
    path.join(root, "assets/css/artigos.css"),
    path.join(root, "assets/js/main.js"),
    ...(await listDir(path.join(root, "assets/js/modules"))).filter((f) => f.endsWith(".js")).sort().map((f) => path.join(root, "assets/js/modules", f)),
];
const hash = createHash("sha1");
for (const f of assetSources) hash.update((await readFile(f, "utf8")).replace(/\?v=[\w]+/g, ""));
const VERSION = hash.digest("hex").slice(0, 10);

// ---------- utilitários ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const wa = (message = SITE.defaultMessage) => `${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
const abs = (p = "") => `${SITE.url}/${p}`;
const areaBySlug = Object.fromEntries(AREAS.map((a) => [a.slug, a]));

function waButton(label, message, { cls = "btn btn-gold", track = "" } = {}) {
    return `<a class="${cls} js-wa" href="${esc(wa(message))}" target="_blank" rel="noopener" data-magnetic${track ? ` data-track="${track}"` : ""}><span class="btn__fill" aria-hidden="true"></span>${WHATSAPP_SVG}<span class="btn__label">${label}</span></a>`;
}

function picture(key, { alt = "", sizes = "100vw", cls = "", eager = false, imgCls = "" } = {}) {
    const m = manifest[key];
    if (!m) throw new Error(`Imagem sem manifest: ${key}`);
    const set = (ext) => m.widths.map((w) => `assets/img/${key}-${w}.${ext} ${w}w`).join(", ");
    const fallbackW = m.widths[Math.min(1, m.widths.length - 1)];
    const ratioH = Math.round((m.height / m.width) * fallbackW);
    return `<picture${cls ? ` class="${cls}"` : ""}><source type="image/avif" srcset="${set("avif")}" sizes="${sizes}"><source type="image/webp" srcset="${set("webp")}" sizes="${sizes}"><img${imgCls ? ` class="${imgCls}"` : ""} src="assets/img/${key}-${fallbackW}.jpg" srcset="${set("jpg")}" sizes="${sizes}" width="${fallbackW}" height="${ratioH}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"'}></picture>`;
}

function sectionHead({ kicker, title, text = "", align = "", id = "" }) {
    return `<div class="section-head${align ? ` section-head--${align}` : ""}">
        <p class="kicker" data-reveal>${kicker}</p>
        <h2${id ? ` id="${id}"` : ""} data-split>${title}</h2>
        ${text ? `<p class="section-head__text" data-reveal>${text}</p>` : ""}
    </div>`;
}

// ---------- blocos comuns ----------
const NAV = [
    { href: "index.html", label: "Início", key: "home" },
    { href: "index.html#areas", label: "Áreas de atuação", key: "areas" },
    { href: "sobre.html", label: "Sobre", key: "sobre" },
    { href: "artigos/", label: "Artigos", key: "artigos" },
    { href: "index.html#faq", label: "Perguntas frequentes", key: "faq" },
    { href: "contato.html", label: "Contato", key: "contato" },
];

function header(page) {
    const links = NAV.map((n) => `<li><a href="${n.href}"${n.key === page.navKey ? ' aria-current="page"' : ""}>${n.label}</a></li>`).join("");
    const mobileLinks = NAV.map((n, i) => `<li><a href="${n.href}"${n.key === page.navKey ? ' aria-current="page"' : ""}><span class="mobile-menu__num">0${i + 1}</span>${n.label}</a></li>`).join("");
    const areaLinks = AREAS.map((a) => `<li><a href="${a.slug}.html">${a.short}</a></li>`).join("");
    return `<header class="site-header${page.lightHero ? "" : " site-header--on-dark"}" data-header>
        <div class="site-header__inner">
            <a class="brand" href="index.html" aria-label="${SITE.name} — página inicial">
                <picture><source type="image/webp" srcset="assets/img/monograma-trigo.webp"><img src="assets/img/monograma-trigo.png" alt="" width="40" height="40"></picture>
                <span class="brand__text"><strong>Alexandre Campos Puchetti</strong><small>Advocacia · ${SITE.oab}</small></span>
            </a>
            <nav class="main-nav" aria-label="Navegação principal"><ul>${links}</ul></nav>
            <a class="btn btn-gold btn-sm header-cta js-wa" href="${esc(wa(page.message))}" target="_blank" rel="noopener" data-magnetic><span class="btn__fill" aria-hidden="true"></span>${WHATSAPP_SVG}<span class="btn__label">WhatsApp</span></a>
            <button class="menu-toggle" type="button" aria-controls="mobile-menu" aria-expanded="false" aria-label="Abrir menu"><span></span><span></span></button>
        </div>
        <div class="read-progress" aria-hidden="true"><span></span></div>
    </header>
    <div class="mobile-menu" id="mobile-menu" aria-label="Menu" hidden>
        <div class="mobile-menu__inner">
            <nav aria-label="Menu principal (celular)"><ul class="mobile-menu__main">${mobileLinks}</ul></nav>
            <div class="mobile-menu__areas"><p class="kicker">Áreas de atuação</p><ul>${areaLinks}</ul></div>
            <div class="mobile-menu__foot">
                ${waButton("Falar pelo WhatsApp", page.message)}
                <p>${SITE.phoneDisplay} · ${SITE.hours}</p>
            </div>
        </div>
    </div>`;
}

function footer(page) {
    const areaLinks = AREAS.map((a) => `<li><a href="${a.slug}.html">${a.crumb || a.name}</a></li>`).join("");
    return `<footer class="site-footer">
        <div class="topo topo--dark" aria-hidden="true"></div>
        <div class="container">
            <div class="footer-cta">
                <p class="footer-cta__title" data-split>Precisa de orientação jurídica sobre uma situação específica?</p>
                ${waButton("Falar com o escritório", page.message)}
            </div>
            <div class="footer-grid">
                <div class="footer-brand">
                    <picture><source type="image/webp" srcset="assets/img/monograma-trigo.webp"><img src="assets/img/monograma-trigo.png" alt="" width="48" height="48" loading="lazy"></picture>
                    <p><strong>${SITE.name}</strong></p>
                    <p>${SITE.oab}</p>
                    <address>${SITE.addressLine}<br>CEP ${SITE.cep}</address>
                </div>
                <nav class="footer-col" aria-label="Áreas de atuação"><p class="footer-col__title">Áreas de atuação</p><ul>${areaLinks}</ul></nav>
                <nav class="footer-col" aria-label="Institucional"><p class="footer-col__title">Institucional</p><ul>
                    <li><a href="index.html">Início</a></li>
                    <li><a href="sobre.html">Sobre</a></li>
                    <li><a href="artigos/">Artigos jurídicos</a></li>
                    <li><a href="index.html#faq">Perguntas frequentes</a></li>
                    <li><a href="contato.html">Contato</a></li>
                    <li><a href="sitemap.xml">Mapa do site</a></li>
                </ul></nav>
                <div class="footer-col"><p class="footer-col__title">Contato</p><ul>
                    <li>Telefone: <a href="${SITE.phoneHref}" class="js-phone">${SITE.phoneDisplay}</a></li>
                    <li>WhatsApp: <a class="js-wa" href="${esc(wa(page.message))}" target="_blank" rel="noopener">${SITE.phoneDisplay}</a></li>
                    <li>Horário: ${SITE.hours}</li>
                </ul>
                <p class="footer-col__title footer-col__title--spaced">Informações legais</p><ul>
                    <li><a href="politica-de-privacidade.html">Política de Privacidade</a></li>
                    <li><a href="termos-de-uso.html">Termos de Uso</a></li>
                    <li><a href="aviso-legal.html">Aviso Legal</a></li>
                    ${GA_ID ? `<li><button type="button" class="footer-linkbtn" data-consent-open>Preferências de cookies</button></li>` : ""}
                </ul></div>
            </div>
            <p class="footer-disclaimer">${SITE.disclaimer}</p>
            <p class="footer-bottom"><span>© 2026 · ${SITE.name}</span><span>Todos os direitos reservados</span></p>
        </div>
    </footer>
    <div class="wa-float" data-wa-float>
        <div class="wa-float__tip" role="status" aria-live="polite">
            <strong>Fale com o escritório</strong>
            <span data-wa-hours>Atendimento: ${SITE.hours}</span>
        </div>
        <a class="wa-float__btn js-wa" href="${esc(wa(page.message))}" target="_blank" rel="noopener" aria-label="Falar com o escritório pelo WhatsApp" data-track="flutuante">${WHATSAPP_SVG}<span class="wa-float__pulse" aria-hidden="true"></span></a>
    </div>`;
}

function layout(page) {
    const title = page.fullTitle || `${page.title} | ${SITE.name}`;
    const canonical = canonicalOf(page);
    const og = page.ogImage || { url: abs("assets/img/og-alexandre-campos-puchetti.jpg"), width: 1200, height: 630, alt: `${SITE.lawyer} em seu escritório em Muriaé/MG` };
    const ogImage = og.url;
    return `<!DOCTYPE html>
<html lang="pt-BR"${page.fast ? " data-fast" : ""}>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${page.file === "index.html" ? `<meta name="google-site-verification" content="${SITE.googleVerification}">\n    ` : ""}<title>${esc(title)}</title>
    <meta name="description" content="${esc(page.description)}">
    <meta name="robots" content="${page.noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}">
    <meta name="author" content="${esc(page.author || SITE.name)}">
    <meta name="theme-color" content="#07130f">
    <link rel="canonical" href="${canonical}">
    <meta property="og:locale" content="pt_BR">
    <meta property="og:site_name" content="${SITE.name}">
    <meta property="og:type" content="${page.ogType || "website"}">
    <meta property="og:title" content="${esc(page.ogTitle || title)}">
    <meta property="og:description" content="${esc(page.ogDescription || page.description)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${ogImage}">
    ${og.width ? `<meta property="og:image:width" content="${og.width}">
    <meta property="og:image:height" content="${og.height}">
    ` : ""}<meta property="og:image:alt" content="${esc(og.alt)}">
    ${page.extraHead || ""}${GA_ID ? `<meta name="ga-measurement-id" content="${GA_ID}">\n    ` : ""}<meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(page.ogTitle || title)}">
    <meta name="twitter:description" content="${esc(page.ogDescription || page.description)}">
    <meta name="twitter:image" content="${ogImage}">
    <link rel="icon" href="favicon.ico" sizes="16x16 32x32 48x48">
    <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png?v=2">
    <link rel="icon" type="image/png" sizes="192x192" href="favicon.png?v=2">
    <link rel="apple-touch-icon" href="apple-touch-icon.png?v=2">
    <link rel="manifest" href="site.webmanifest">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Manrope:wght@400;500;600;700&display=swap">
    <link rel="stylesheet" href="assets/css/main.css?v=${VERSION}">${page.articlesCss ? `\n    <link rel="stylesheet" href="assets/css/artigos.css?v=${VERSION}">` : ""}
    <script>
        (function () {
            var d = document.documentElement, reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            d.classList.add("js");
            if (reduce) d.classList.add("reduce-motion");
            try {
                // Páginas de leitura (data-fast) não exibem a abertura animada, para o texto aparecer de imediato.
                if (!reduce && !sessionStorage.getItem("acp-visited") && !d.hasAttribute("data-fast")) d.classList.add("show-preloader");
                else if (!reduce && sessionStorage.getItem("acp-transition")) d.classList.add("page-enter");
                sessionStorage.removeItem("acp-transition");
                sessionStorage.setItem("acp-visited", "1");
            } catch (e) {}
            // Segurança: se as animações não iniciarem, o conteúdo aparece mesmo assim.
            setTimeout(function () { if (!d.classList.contains("anim-ready")) d.classList.add("anim-failed"); }, 2500);
        })();
    </script>
    ${page.jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n    ")}
</head>
<body class="page-${page.bodyClass}" data-page="${page.bodyClass}">
    <a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <div class="preloader" aria-hidden="true"><div class="preloader__mark"><img src="assets/img/monograma-trigo.png" alt="" width="72" height="72"></div><span class="preloader__line"></span></div>
    <div class="page-curtain" aria-hidden="true"></div>
    <div class="grain" aria-hidden="true"></div>
    ${header(page)}
    <main id="conteudo" tabindex="-1">
${page.main}
    </main>
    ${footer(page)}
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" defer></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js" defer></script>
    <script src="https://unpkg.com/lenis@1.1.13/dist/lenis.min.js" defer></script>
    <script type="module" src="assets/js/main.js?v=${VERSION}"></script>
</body>
</html>
`;
}

function canonicalOf(page) {
    if (page.urlPath !== undefined) return abs(page.urlPath);
    return abs(page.file === "index.html" ? "" : page.file);
}

// ---------- JSON-LD ----------
const ORG_ID = `${SITE.url}/#escritorio`;
function orgSchema() {
    return {
        "@context": "https://schema.org",
        "@type": ["LegalService", "Attorney"],
        "@id": ORG_ID,
        name: SITE.name,
        url: `${SITE.url}/`,
        logo: abs("assets/img/monograma-trigo.png"),
        image: abs("assets/img/og-alexandre-campos-puchetti.jpg"),
        telephone: SITE.phoneSchema,
        address: {
            "@type": "PostalAddress",
            streetAddress: "Rua Coronel Marciano Rodrigues, 151, Loja 10 B, Centro",
            addressLocality: SITE.city,
            addressRegion: SITE.state,
            postalCode: SITE.cep,
            addressCountry: "BR",
        },
        geo: { "@type": "GeoCoordinates", latitude: SITE.geo.latitude, longitude: SITE.geo.longitude },
        areaServed: { "@type": "City", name: "Muriaé" },
        openingHoursSpecification: [
            ["08:00", "11:30"],
            ["13:00", "17:00"],
        ].map(([opens, closes]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens, closes })),
        knowsAbout: AREAS.map((a) => a.name),
        employee: { "@type": "Person", name: SITE.lawyer, jobTitle: "Advogado", identifier: SITE.oab },
    };
}
function faqSchema(items, id) {
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": id,
        mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    };
}
function breadcrumbSchema(name, file) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: `${SITE.url}/` },
            { "@type": "ListItem", position: 2, name, item: abs(file) },
        ],
    };
}

// ---------- componentes ----------
function marquee() {
    const items = AREAS.map((a) => `<li>${icon(a.icon, { size: 20 })}<span>${a.crumb || a.name}</span></li>`).join("");
    return `<section class="marquee" aria-label="Áreas de atuação">
        <div class="marquee__track" data-marquee>
            <ul class="marquee__list">${items}</ul>
            <ul class="marquee__list" aria-hidden="true">${items}</ul>
        </div>
    </section>`;
}

function areaCard(a) {
    const services = a.services.map((s) => `<li>${icon("check", { size: 16 })}<span>${s}</span></li>`).join("");
    if (a.featured) {
        return `<article class="area-card area-card--featured" data-tilt data-reveal>
            <span class="area-card__glow" aria-hidden="true"></span>
            <div class="area-card__top"><span class="area-card__icon">${icon(a.icon, { size: 34, draw: true })}</span><span class="area-card__badge">Área em destaque</span></div>
            <h3 class="area-card__title"><a href="${a.slug}.html">${a.name}</a></h3>
            <p class="area-card__text">${a.cardText}</p>
            <ul class="area-card__chips" aria-label="Situações analisadas">${a.services.map((s) => `<li>${s}</li>`).join("")}</ul>
            <a class="area-card__more" href="${a.slug}.html" aria-hidden="true" tabindex="-1">Conhecer a área ${icon("arrow", { size: 18 })}</a>
        </article>`;
    }
    return `<article class="area-card" data-tilt data-reveal>
        <span class="area-card__glow" aria-hidden="true"></span>
        <div class="area-card__top"><span class="area-card__icon">${icon(a.icon, { size: 28, draw: true })}</span></div>
        <h3 class="area-card__title"><a href="${a.slug}.html">${a.name}</a></h3>
        <p class="area-card__text">${a.cardText}</p>
        <div class="area-card__panel" id="servicos-${a.slug}">
            <p class="area-card__panel-title">Situações analisadas</p>
            <ul>${services}</ul>
        </div>
        <div class="area-card__actions">
            <button class="area-card__toggle" type="button" aria-expanded="false" aria-controls="servicos-${a.slug}">${icon("plus", { size: 16 })}<span>Ver situações</span></button>
            <a class="area-card__more" href="${a.slug}.html" aria-hidden="true" tabindex="-1">Saiba mais ${icon("arrow", { size: 16 })}</a>
        </div>
    </article>`;
}

function areasGrid() {
    return `<div class="areas-grid">
        ${AREAS.map(areaCard).join("\n")}
        <article class="area-card area-card--cta" data-reveal>
            <p class="area-card__title">Não encontrou a sua situação?</p>
            <p class="area-card__text">Relate o caso pelo WhatsApp. A viabilidade de qualquer medida depende de avaliação individual.</p>
            ${waButton("Falar com o advogado", SITE.defaultMessage, { cls: "btn btn-outline-light" })}
        </article>
    </div>`;
}

function timeline(steps, note = "") {
    return `<div class="timeline" data-timeline>
        <div class="timeline__rail" aria-hidden="true"><span class="timeline__fill"></span></div>
        <ol class="timeline__list">
            ${steps.map((s, i) => `<li class="timeline__step" data-step-index="${i}"><span class="timeline__dot" aria-hidden="true">${i + 1}</span><div><h3>${s.title}</h3><p>${s.text}</p></div></li>`).join("")}
        </ol>
        ${note ? `<p class="legal-note" data-reveal>${note}</p>` : ""}
    </div>`;
}

function gallery() {
    const items = GALLERY.map((g, i) => `<figure class="gallery__item" data-gallery-item>
            <button class="gallery__open" type="button" data-lightbox="${i}" aria-label="Ampliar foto: ${g.caption}">
                ${picture(g.img, { alt: g.alt, sizes: "(min-width: 1024px) 34vw, 78vw" })}
                <span class="gallery__zoom" aria-hidden="true">${icon("expand", { size: 18 })}</span>
            </button>
            <figcaption><span class="gallery__num">0${i + 1}</span>${g.caption}</figcaption>
        </figure>`).join("");
    const data = GALLERY.map((g) => ({ src: `assets/img/${g.img}-${manifest[g.img].widths.at(-1)}.webp`, alt: g.alt, caption: g.caption }));
    return `<div class="gallery" data-gallery>
        <div class="gallery__viewport" data-gallery-viewport>
            <div class="gallery__track" data-gallery-track>${items}</div>
        </div>
        <p class="gallery__hint" aria-hidden="true">Arraste para ver mais ${icon("arrow", { size: 16 })}</p>
        <script type="application/json" data-gallery-data>${JSON.stringify(data)}</script>
    </div>
    <dialog class="lightbox" data-lightbox-dialog aria-label="Foto ampliada do escritório">
        <figure class="lightbox__figure"><img alt="" data-lightbox-img><figcaption data-lightbox-caption></figcaption></figure>
        <button class="lightbox__btn lightbox__close" type="button" data-lightbox-close aria-label="Fechar">${icon("close")}</button>
        <button class="lightbox__btn lightbox__prev" type="button" data-lightbox-prev aria-label="Foto anterior">${icon("chevronLeft")}</button>
        <button class="lightbox__btn lightbox__next" type="button" data-lightbox-next aria-label="Próxima foto">${icon("chevronRight")}</button>
    </dialog>`;
}

function faqAccordion(items, { filters = false, idPrefix = "faq" } = {}) {
    const usedCats = FAQ_CATEGORIES.filter((c) => items.some((i) => i.cat === c.id));
    const controls = filters
        ? `<div class="faq-controls">
            <label class="faq-search" for="${idPrefix}-busca">
                ${icon("search", { size: 20 })}
                <span class="visually-hidden">Buscar nas perguntas frequentes</span>
                <input id="${idPrefix}-busca" type="search" placeholder="Buscar uma dúvida…" autocomplete="off" data-faq-search>
            </label>
            <div class="faq-chips" role="group" aria-label="Filtrar perguntas por tema">
                <button type="button" class="chip" aria-pressed="true" data-faq-filter="todas">Todas</button>
                ${usedCats.map((c) => `<button type="button" class="chip" aria-pressed="false" data-faq-filter="${c.id}">${c.label}</button>`).join("")}
            </div>
            <p class="faq-count" role="status" aria-live="polite" data-faq-count></p>
        </div>`
        : "";
    return `<div class="faq" data-faq>
        ${controls}
        <div class="faq-list">
            ${items.map((f) => `<details class="faq-item" data-cat="${f.cat}" data-reveal><summary><span>${f.q}</span><span class="faq-item__icon" aria-hidden="true"></span></summary><div class="faq-item__body"><p>${f.a}</p></div></details>`).join("\n            ")}
        </div>
        ${filters ? `<p class="faq-empty" data-faq-empty hidden>Nenhuma pergunta encontrada. Tente outro termo ou <a href="contato.html">fale com o escritório</a>.</p>` : ""}
    </div>`;
}

function contactForm(defaultArea = "") {
    const options = [...AREAS.map((a) => a.crumb || a.name), "Outro assunto"];
    const radios = options.map((o, i) => `<label class="choice"><input type="radio" name="area" value="${esc(o)}"${o === defaultArea ? " checked" : ""} required><span class="choice__box">${i < AREAS.length ? icon(AREAS[i].icon, { size: 20 }) : icon("plus", { size: 20 })}<span>${o}</span></span></label>`).join("");
    return `<form class="mstep" id="contactForm" novalidate data-form>
        <div class="mstep__head">
            <ol class="mstep__labels"><li class="is-current">Área</li><li>Descrição</li><li>Contato</li></ol>
            <div class="mstep__bar" aria-hidden="true"><span data-form-progress></span></div>
            <p class="visually-hidden" aria-live="polite" data-form-stepinfo>Etapa 1 de 3</p>
        </div>
        <input type="text" name="empresa" class="honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">
        <fieldset class="mstep__step is-active" data-step="1">
            <legend>Qual área está relacionada ao seu caso?</legend>
            <div class="choice-grid">${radios}</div>
            <p class="field-error" data-error-for="area" role="alert"></p>
        </fieldset>
        <fieldset class="mstep__step" data-step="2">
            <legend>Descreva brevemente a situação</legend>
            <label for="descricao">Breve descrição do caso <span aria-hidden="true">*</span></label>
            <textarea id="descricao" name="descricao" rows="5" maxlength="800" required aria-describedby="descricao-ajuda descricao-contador"></textarea>
            <div class="field-meta"><p id="descricao-ajuda">${SITE.sensitiveWarning}</p><p id="descricao-contador" data-counter>0/800</p></div>
            <p class="field-error" data-error-for="descricao" role="alert"></p>
        </fieldset>
        <fieldset class="mstep__step" data-step="3">
            <legend>Como podemos retornar o contato?</legend>
            <div class="field"><label for="nome">Nome <span aria-hidden="true">*</span></label><input id="nome" name="nome" type="text" autocomplete="name" required><p class="field-error" data-error-for="nome" role="alert"></p></div>
            <div class="field"><label for="telefone">Telefone/WhatsApp <span aria-hidden="true">*</span></label><input id="telefone" name="telefone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(32) 90000-0000" required><p class="field-error" data-error-for="telefone" role="alert"></p></div>
            <div class="field"><label for="email">E-mail <span class="optional">(opcional)</span></label><input id="email" name="email" type="email" autocomplete="email"><p class="field-error" data-error-for="email" role="alert"></p></div>
            <label class="consent" for="privacidade"><input id="privacidade" name="privacidade" type="checkbox" required><span class="consent__box" aria-hidden="true">${icon("check", { size: 14, stroke: 2.5 })}</span><span>Li e concordo com a <a href="politica-de-privacidade.html">Política de Privacidade</a>.</span></label>
            <p class="field-error" data-error-for="privacidade" role="alert"></p>
            <p class="form-note">${SITE.noContract}</p>
        </fieldset>
        <div class="mstep__nav">
            <button class="btn btn-ghost-dark" type="button" data-form-back hidden>Voltar</button>
            <button class="btn btn-dark" type="button" data-form-next><span class="btn__fill" aria-hidden="true"></span><span class="btn__label">Continuar</span>${icon("arrow", { size: 18 })}</button>
            <button class="btn btn-gold" type="submit" data-form-submit hidden><span class="btn__fill" aria-hidden="true"></span>${WHATSAPP_SVG}<span class="btn__label">Enviar pelo WhatsApp</span></button>
        </div>
        <p class="form-status" role="status" aria-live="polite" data-form-status></p>
        <noscript><p class="form-status">Para usar o formulário, ative o JavaScript ou fale diretamente pelo <a href="${esc(wa())}" target="_blank" rel="noopener">WhatsApp</a>.</p></noscript>
    </form>`;
}

function mapBlock() {
    const src = `https://www.google.com/maps?q=${encodeURIComponent(SITE.mapQuery)}&output=embed`;
    return `<div class="map-frame" data-map data-src="${esc(src)}">
        <div class="map-frame__placeholder">${icon("pin", { size: 28 })}<span>Mapa do escritório em Muriaé/MG</span></div>
        <noscript><iframe title="Mapa do escritório ${SITE.name} em Muriaé/MG" src="${esc(src)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></noscript>
    </div>`;
}

function contactInfo() {
    return `<ul class="contact-info">
        <li>${icon("pin", { size: 22 })}<div><p class="contact-info__label">Endereço</p><p>${SITE.addressLine}<br>CEP ${SITE.cep}</p></div></li>
        <li>${icon("phone", { size: 22 })}<div><p class="contact-info__label">Telefone e WhatsApp</p><p><a href="${SITE.phoneHref}" class="js-phone">${SITE.phoneDisplay}</a></p></div></li>
        <li>${icon("clock", { size: 22 })}<div><p class="contact-info__label">Horário de atendimento</p><p>${SITE.hours}</p></div></li>
    </ul>`;
}

function aboutBlock({ headingTag = "h2" } = {}) {
    return `<div class="about-grid">
        <div class="about-media" data-reveal="clip">
            <span class="about-media__frame" aria-hidden="true"></span>
            ${picture("dr-alexandre-retrato", { alt: `Retrato do ${SITE.lawyer}, ${SITE.oab}`, sizes: "(min-width: 1024px) 40vw, 90vw" })}
        </div>
        <div class="about-copy">
            <p class="kicker" data-reveal>Sobre o advogado</p>
            <${headingTag} data-split>Atendimento próximo, técnico e individualizado.</${headingTag}>
            <div class="oab-mark" data-reveal>
                <span class="oab-mark__label">Inscrição</span>
                <span class="oab-mark__prefix">OAB/MG</span>
                <span class="oab-mark__number">${SITE.oabNumber}</span>
            </div>
            <p data-reveal>${SITE.lawyer}, inscrito na OAB/MG sob o nº ${SITE.oabNumber}, é ${SITE.title}, com atuação voltada também à defesa em execuções de títulos executivos judiciais e extrajudiciais.</p>
            <p data-reveal>O atendimento é conduzido com relato inicial, solicitação dos documentos pertinentes, avaliação dos riscos e indicação das medidas juridicamente adequadas, sempre com respeito à ética profissional e sem promessas de resultado.</p>
            <div data-reveal>${waButton("Falar com o escritório", SITE.defaultMessage)}</div>
        </div>
    </div>`;
}

function pageHero({ crumb, kicker, title, text, iconName, actions = "" }) {
    return `<section class="page-hero">
            <div class="topo topo--dark" aria-hidden="true"></div>
            <div class="container page-hero__inner">
                <nav class="breadcrumbs" aria-label="Você está em"><ol><li><a href="index.html">Início</a></li><li aria-current="page">${crumb}</li></ol></nav>
                ${iconName ? `<span class="page-hero__icon">${icon(iconName, { size: 44, stroke: 1.25, draw: true })}</span>` : ""}
                <p class="kicker" data-hero-item>${kicker}</p>
                <h1 data-split="hero">${title}</h1>
                ${text ? `<p class="page-hero__text" data-hero-item>${text}</p>` : ""}
                ${actions ? `<div class="page-hero__actions" data-hero-item>${actions}</div>` : ""}
            </div>
        </section>`;
}

// ---------- páginas ----------
const pages = [];

// HOME
{
    const rural = areaBySlug["defesa-do-produtor-rural"];
    const main = `
        <section class="hero" id="inicio">
            <div class="topo topo--dark" aria-hidden="true"></div>
            <div class="container hero__grid">
                <div class="hero__copy">
                    <p class="kicker" data-hero-item>Advocacia em Muriaé/MG</p>
                    <h1 data-split="hero">Assessoria jurídica técnica para decisões importantes</h1>
                    <p class="hero__lead" data-hero-item>Atendimento em Direito Bancário, Defesa do Produtor Rural, Direito da Saúde, Direito Previdenciário, Família, Sucessões e medidas judiciais ou administrativas estratégicas.</p>
                    <div class="hero__actions" data-hero-item>
                        ${waButton("Falar pelo WhatsApp", SITE.defaultMessage, { track: "hero" })}
                        <a class="btn btn-outline-light" href="#areas" data-magnetic><span class="btn__fill" aria-hidden="true"></span><span class="btn__label">Conhecer áreas de atuação</span></a>
                    </div>
                    <ul class="seals" aria-label="Diferenciais do atendimento">
                        ${DIFFERENTIALS.map((d) => `<li class="seal" data-seal>${icon("check", { size: 16, stroke: 2 })}<span>${d}</span></li>`).join("")}
                    </ul>
                </div>
                <div class="hero__media">
                    <div class="hero__photo" data-hero-media>
                        ${picture("dr-alexandre", { alt: `${SITE.lawyer} à mesa de seu escritório em Muriaé/MG`, sizes: "(min-width: 1024px) 42vw, 92vw", eager: true, imgCls: "hero__img" })}
                    </div>
                    <p class="hero__caption" data-hero-item><span>${SITE.oab}</span>Escritório no Centro de Muriaé/MG</p>
                </div>
            </div>
            <a class="scroll-cue" href="#escritorio" aria-label="Rolar para o conteúdo">${icon("mouse", { size: 22 })}<span>Role para baixo</span></a>
        </section>

        ${marquee()}

        <section class="section section--light" id="escritorio">
            <div class="topo topo--light" aria-hidden="true"></div>
            <div class="container">
                <div class="intro-grid">
                    ${sectionHead({ kicker: "Escritório de advocacia", title: "Atendimento jurídico com organização, serenidade e análise documental." })}
                    <p class="intro-grid__text" data-reveal>${SITE.name} é um escritório sediado em Muriaé/MG, com atuação consultiva e contenciosa. O trabalho é desenvolvido mediante análise individualizada de cada situação, orientação clara ao cliente e definição da estratégia jurídica adequada às circunstâncias do caso.</p>
                </div>
                <div class="values-grid">
                    ${VALUES.map((v, i) => `<article class="value-card" data-reveal><span class="value-card__num">0${i + 1}</span><h3>${v.title}</h3><p>${v.text}</p></article>`).join("")}
                </div>
                <div class="inline-cta" data-reveal>
                    <p>Precisa de orientação jurídica sobre uma situação específica?</p>
                    ${waButton("Falar com o advogado", SITE.defaultMessage, { cls: "btn btn-dark" })}
                </div>
            </div>
        </section>

        <section class="section section--dark" id="areas">
            <div class="topo topo--dark" aria-hidden="true"></div>
            <div class="container">
                ${sectionHead({ kicker: "Áreas de atuação", title: "Antes de uma medida jurídica, cada situação precisa ser compreendida com cuidado.", text: "As áreas abaixo apresentam temas frequentemente analisados pelo escritório. A viabilidade de qualquer medida depende de avaliação individual do caso." })}
                ${areasGrid()}
            </div>
        </section>

        <section class="rural-band" id="produtor-rural">
            <div class="rural-band__media" aria-hidden="true">${picture("campo-rural", { alt: "", sizes: "100vw", imgCls: "rural-band__img" })}</div>
            <div class="container rural-band__inner">
                <div class="rural-band__copy">
                    <p class="kicker" data-reveal>${icon("rural", { size: 18 })} Defesa do Produtor Rural</p>
                    <h2 data-split>Preservação da atividade produtiva, do patrimônio e do acesso ao crédito.</h2>
                    <p data-reveal>${rural.intro}</p>
                    <p data-reveal>${rural.context.text}</p>
                    <div class="rural-band__actions" data-reveal>
                        ${waButton("Sou produtor rural e quero orientação", rural.message, { track: "faixa-rural" })}
                        <a class="text-link text-link--light" href="${rural.slug}.html">Ver a página completa ${icon("arrow", { size: 18 })}</a>
                    </div>
                </div>
                <ul class="rural-band__list" aria-label="Situações analisadas para o produtor rural">
                    ${rural.services.map((s) => `<li data-reveal>${icon("check", { size: 18, stroke: 2 })}<span>${s}</span></li>`).join("")}
                </ul>
            </div>
        </section>

        <section class="section section--light section--gallery" id="estrutura">
            <div class="container">
                ${sectionHead({ kicker: "Estrutura real", title: "Ambiente organizado para atendimento jurídico presencial e análise reservada.", text: "As fotografias apresentam a entrada, o corredor e as salas do escritório em Muriaé/MG." })}
            </div>
            ${gallery()}
        </section>

        <section class="section section--cream" id="atendimento">
            <div class="container">
                ${sectionHead({ kicker: "Como funciona o atendimento", title: "Um processo objetivo para compreender o caso antes de indicar medidas." })}
                ${timeline(STEPS_HOME, SITE.noContract)}
                <div class="inline-cta" data-reveal>
                    <p>Quer entender quais documentos podem ser necessários?</p>
                    ${waButton("Iniciar atendimento pelo WhatsApp", SITE.defaultMessage, { cls: "btn btn-dark" })}
                </div>
            </div>
        </section>

        <section class="section section--dark guidance">
            <div class="topo topo--dark" aria-hidden="true"></div>
            <div class="container guidance__grid">
                ${sectionHead({ kicker: "Orientação jurídica", title: "Por que procurar orientação antes de tomar uma decisão?", text: "A orientação jurídica permite compreender riscos, avaliar documentos, prevenir perda de prazos e definir alternativas judiciais ou extrajudiciais de forma compatível com os fatos apresentados." })}
                <ul class="check-list" data-checklist>
                    ${GUIDANCE.map((g) => `<li data-reveal><span class="check-list__mark">${icon("check", { size: 18, stroke: 2, draw: true })}</span><span>${g}</span></li>`).join("")}
                </ul>
            </div>
        </section>

        <section class="section section--light" id="sobre">
            <div class="container">${aboutBlock()}</div>
        </section>

        <section class="section section--dark" id="faq">
            <div class="topo topo--dark" aria-hidden="true"></div>
            <div class="container container--narrow">
                ${sectionHead({ kicker: "Perguntas frequentes", title: "Informações iniciais para orientar seu contato.", align: "center" })}
                ${faqAccordion(FAQ, { filters: true })}
            </div>
        </section>

        <section class="section section--cream contact" id="contato">
            <div class="container contact__grid">
                <div class="contact__copy">
                    ${sectionHead({ kicker: "Contato", title: "Precisa de orientação jurídica sobre uma dessas situações?", text: "Entre em contato para relatar o caso e receber informações sobre a análise documental e as possibilidades de atendimento." })}
                    ${contactInfo()}
                </div>
                <div class="contact__form" data-reveal>${contactForm()}</div>
            </div>
            <div class="container" id="localizacao">
                ${mapBlock()}
            </div>
        </section>`;

    pages.push({
        file: "index.html",
        bodyClass: "home",
        navKey: "home",
        fullTitle: `${SITE.name} | Advogado em Muriaé/MG`,
        description: "Advocacia em Muriaé/MG com atuação em Direito Bancário, Defesa do Produtor Rural, Saúde, Previdenciário, Família, Sucessões, Inventário e Mandado de Segurança.",
        ogTitle: `${SITE.name} | Advocacia em Muriaé/MG`,
        ogDescription: "Atuação em Direito Bancário, Defesa do Produtor Rural, Saúde, Previdenciário, Família, Sucessões, Inventário e Mandado de Segurança.",
        message: SITE.defaultMessage,
        jsonld: [orgSchema(), faqSchema(FAQ, `${SITE.url}/#faq`)],
        main,
    });
}

// ÁREAS
for (const a of AREAS) {
    let faqItems = FAQ.filter((f) => a.faqCats.includes(f.cat));
    if (a.faqFilter) faqItems = faqItems.filter(a.faqFilter);
    faqItems = [...faqItems, ...FAQ.filter((f) => ["O escritório garante resultado?", "O primeiro contato cria contratação automática?"].includes(f.q))];
    const others = AREAS.filter((o) => o.slug !== a.slug);
    const crumb = a.crumb || a.name;

    const main = `
        ${pageHero({
            crumb,
            kicker: "Área de atuação",
            title: a.name,
            text: a.intro,
            iconName: a.icon,
            actions: `${waButton("Falar sobre este assunto", a.message, { track: a.slug })}<a class="btn btn-outline-light" href="#documentos" data-magnetic><span class="btn__fill" aria-hidden="true"></span><span class="btn__label">Documentos úteis</span></a>`,
        })}

        <section class="section section--light">
            <div class="container">
                ${sectionHead({ kicker: "Serviços relacionados", title: "Situações em que podemos analisar", text: a.lead || "Cada situação possui particularidades. A viabilidade de qualquer medida depende da análise individual dos fatos e dos documentos." })}
                <ul class="service-grid">
                    ${a.services.map((s, i) => `<li class="service-card" data-reveal><span class="service-card__num">${String(i + 1).padStart(2, "0")}</span><span class="service-card__text">${s}</span>${icon("check", { size: 18, stroke: 2, cls: "icon service-card__check" })}</li>`).join("")}
                </ul>
            </div>
        </section>

        <section class="section section--cream" id="documentos">
            <div class="container split">
                <div>
                    ${sectionHead({ kicker: a.context.title, title: "Documentos que podem ser necessários", text: a.context.text })}
                    <p class="legal-note legal-note--inline" data-reveal>${SITE.sensitiveWarning}</p>
                </div>
                <ul class="doc-list">
                    ${a.documents.map((d) => `<li data-reveal>${icon("document", { size: 22 })}<span>${d}</span></li>`).join("")}
                </ul>
            </div>
        </section>

        <section class="section section--dark">
            <div class="topo topo--dark" aria-hidden="true"></div>
            <div class="container container--narrow">
                ${sectionHead({ kicker: "Perguntas frequentes", title: `Dúvidas sobre ${a.short === "Mandado de Segurança" ? "mandado de segurança" : a.crumb || a.name}`, align: "center" })}
                ${faqAccordion(faqItems)}
            </div>
        </section>

        <section class="cta-band">
            <div class="container cta-band__inner">
                <div>
                    <p class="kicker" data-reveal>Atendimento</p>
                    <h2 data-split>Precisa de orientação sobre ${a.short === "Produtor Rural" ? "a sua atividade rural" : a.crumb || a.name}?</h2>
                    <p data-reveal>${SITE.noContract}</p>
                </div>
                <div data-reveal>${waButton("Falar pelo WhatsApp", a.message, { track: `${a.slug}-cta` })}</div>
            </div>
        </section>

        <section class="section section--light">
            <div class="container">
                ${sectionHead({ kicker: "Outras áreas de atuação", title: "Conheça as demais áreas analisadas pelo escritório." })}
                <ul class="other-areas">
                    ${others.map((o) => `<li data-reveal><a class="other-area" href="${o.slug}.html"><span class="other-area__icon">${icon(o.icon, { size: 24 })}</span><span class="other-area__name">${o.crumb || o.name}</span>${icon("arrowUpRight", { size: 18, cls: "icon other-area__arrow" })}</a></li>`).join("")}
                </ul>
            </div>
        </section>`;

    pages.push({
        file: `${a.slug}.html`,
        bodyClass: `area area-${a.slug}`,
        navKey: "areas",
        title: a.name,
        fullTitle: `${a.metaTitle} | ${SITE.name}`,
        description: a.metaDescription,
        ogTitle: a.name,
        ogDescription: a.ogDescription,
        ogType: "article",
        message: a.message,
        jsonld: [breadcrumbSchema(crumb, `${a.slug}.html`), faqSchema(faqItems, `${abs(`${a.slug}.html`)}#faq`)],
        main,
    });
}

// SOBRE
pages.push({
    file: "sobre.html",
    bodyClass: "sobre",
    navKey: "sobre",
    title: "Sobre",
    description: `Conheça o escritório ${SITE.name}, sediado em Muriaé/MG, e a atuação do ${SITE.lawyer}, ${SITE.oab}.`,
    message: SITE.defaultMessage,
    jsonld: [breadcrumbSchema("Sobre", "sobre.html"), orgSchema()],
    main: `
        ${pageHero({
            crumb: "Sobre",
            kicker: "Institucional",
            title: SITE.name,
            text: "Escritório sediado em Muriaé/MG, com atendimento jurídico conduzido por análise individual, organização documental e comunicação clara com o cliente.",
            actions: `${waButton("Falar pelo WhatsApp", SITE.defaultMessage)}<a class="btn btn-outline-light" href="index.html#areas" data-magnetic><span class="btn__fill" aria-hidden="true"></span><span class="btn__label">Conhecer áreas</span></a>`,
        })}
        <section class="section section--light"><div class="container">${aboutBlock()}</div></section>
        <section class="section section--cream">
            <div class="container">
                <div class="values-grid">
                    ${VALUES.map((v, i) => `<article class="value-card" data-reveal><span class="value-card__num">0${i + 1}</span><h3>${v.title}</h3><p>${v.text}</p></article>`).join("")}
                </div>
            </div>
        </section>
        <section class="section section--dark">
            <div class="topo topo--dark" aria-hidden="true"></div>
            <div class="container">
                ${sectionHead({ kicker: "Como funciona", title: "Da primeira conversa ao acompanhamento do caso.", text: "O atendimento busca tornar o processo mais claro para o cliente, com organização das informações e orientação sobre próximos passos." })}
                ${timeline(STEPS_ABOUT)}
                <div class="inline-cta inline-cta--dark" data-reveal>
                    <p>Quer relatar uma situação para análise inicial?</p>
                    ${waButton("Falar com o advogado", SITE.defaultMessage)}
                </div>
            </div>
        </section>
        <section class="section section--light section--gallery">
            <div class="container">${sectionHead({ kicker: "Estrutura", title: "Fotos reais do escritório em Muriaé/MG." })}</div>
            ${gallery()}
        </section>`,
});

// CONTATO
pages.push({
    file: "contato.html",
    bodyClass: "contato",
    navKey: "contato",
    title: "Contato",
    description: `Entre em contato com ${SITE.name} em Muriaé/MG pelo WhatsApp, telefone ou formulário inicial de atendimento.`,
    message: SITE.defaultMessage,
    jsonld: [breadcrumbSchema("Contato", "contato.html"), orgSchema()],
    main: `
        ${pageHero({
            crumb: "Contato",
            kicker: "Contato",
            title: "Precisa de orientação jurídica?",
            text: "Entre em contato para relatar o caso e receber informações sobre a análise documental e as possibilidades de atendimento.",
            actions: `${waButton("Falar pelo WhatsApp", SITE.defaultMessage)}<a class="btn btn-outline-light js-phone" href="${SITE.phoneHref}" data-magnetic><span class="btn__fill" aria-hidden="true"></span>${icon("phone", { size: 18 })}<span class="btn__label">Ligar para o escritório</span></a>`,
        })}
        <section class="section section--cream contact">
            <div class="container contact__grid">
                <div class="contact__copy">
                    ${sectionHead({ kicker: "Atendimento em Muriaé/MG", title: "Canais de atendimento" })}
                    ${contactInfo()}
                    <p class="legal-note legal-note--inline" data-reveal>${SITE.noContract}</p>
                </div>
                <div class="contact__form" data-reveal>${contactForm()}</div>
            </div>
            <div class="container" id="localizacao">${mapBlock()}</div>
        </section>`,
});

// PÁGINAS LEGAIS
for (const l of LEGAL_PAGES) {
    pages.push({
        file: `${l.slug}.html`,
        bodyClass: "legal",
        navKey: "",
        title: l.title,
        description: l.metaDescription,
        message: SITE.defaultMessage,
        jsonld: [breadcrumbSchema(l.title, `${l.slug}.html`)],
        main: `
        ${pageHero({ crumb: l.title, kicker: "Informações legais", title: l.title, text: l.intro })}
        <section class="section section--light">
            <div class="container prose">
                ${l.sections.map(([t, p]) => `<section class="prose__block" data-reveal><h2>${t}</h2><p>${p}</p></section>`).join("\n                ")}
                <p class="prose__updated">Última atualização: novembro de 2026.</p>
            </div>
        </section>`,
    });
}

// ---------- ARTIGOS JURÍDICOS ----------
const CATEGORIES = await loadCategories(root);
const content = await loadArticles(root, { now: NOW, categories: CATEGORIES });
const ARTICLES = WITH_DRAFTS ? [...content.published, ...content.scheduled, ...content.drafts] : content.published;
const imageWarnings = [];
const PER_PAGE = 9;
const ARTICLES_DESC = "Artigos jurídicos informativos sobre Direito Bancário, Direito do Produtor Rural, Crédito Rural, Saúde, Previdenciário, Família, Sucessões e Consumidor.";
const isLawyer = (name) => !name || name === SITE.lawyer;
const categoryIcon = (c) => CATEGORY_ICONS[c?.slug] || areaBySlug[c?.area]?.icon || "book";
const articleUrl = (a) => `artigos/${a.slug}/`;
const lastmodOf = (a) => isoDate(a.updated || a.published);

let currentImages = new Map();
const renderMarkdown = createRenderer({
    siteUrl: SITE.url,
    areaSlugs: AREAS.map((a) => a.slug),
    imageHtml(href, alt, title) {
        const img = currentImages.get(href);
        if (!img) return "";
        return `<figure class="article-figure">${pictureHtml(img, { alt, sizes: "(min-width: 900px) 760px, 92vw" })}${title ? `<figcaption>${esc(title)}</figcaption>` : ""}</figure>`;
    },
});

function bodyImageHrefs(markdown) {
    const m = new Marked({ gfm: true });
    const hrefs = [];
    m.walkTokens(m.lexer(String(markdown ?? "")), (t) => t.type === "image" && hrefs.push(t.href));
    return [...new Set(hrefs)];
}

for (const a of ARTICLES) {
    a.url = articleUrl(a);
    a.cover = await prepareImage(root, a.capa, [480, 800, 1200], imageWarnings);
    a.social = a.socialImage ? await prepareImage(root, a.socialImage, [1200], imageWarnings) : null;
    currentImages = new Map();
    for (const href of bodyImageHrefs(a.corpo)) currentImages.set(href, await prepareImage(root, href, [480, 800, 1200], imageWarnings));
    const r = renderMarkdown(a.corpo);
    a.html = r.html.replace(/<p>\s*(<figure class="article-figure">[\s\S]*?<\/figure>)\s*<\/p>/g, "$1");
    a.headings = r.headings;
    a.words = r.words;
    a.minutes = readingMinutes(r.words);
    a.areaList = [...new Set([a.category?.area, ...a.areas, ...r.areaLinks])].filter((s) => areaBySlug[s]);
    a.preview = a.status !== "publicado" || a.published > NOW;
}

function coverMedia(a, { eager = false, sizes = "(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 92vw" } = {}) {
    if (a.cover) return pictureHtml(a.cover, { alt: a.capaAlt || "", sizes, eager });
    return `<span class="article-ph" aria-hidden="true"><span class="article-ph__topo"></span>${icon(categoryIcon(a.category), { size: 40, stroke: 1.25 })}</span>`;
}

function articleCard(a, { featured = false, headingTag = "h3" } = {}) {
    const date = a.published ? `<time datetime="${a.published.toISOString()}">${formatDate(a.published)}</time>` : "";
    return `<article class="article-card${featured ? " article-card--featured" : ""}" data-cat="${a.category?.slug || ""}">
            <a class="article-card__media" href="${a.url}" tabindex="-1" aria-hidden="true">${coverMedia(a, featured ? { sizes: "(min-width: 1024px) 56vw, 92vw" } : {})}</a>
            <div class="article-card__body">
                ${a.category ? `<p class="article-card__cat">${esc(a.category.nome)}</p>` : ""}
                <${headingTag} class="article-card__title"><a href="${a.url}">${esc(a.titulo)}</a></${headingTag}>
                ${a.resumo ? `<p class="article-card__excerpt">${esc(a.resumo)}</p>` : ""}
                <p class="article-card__meta"><span>${esc(a.autor || SITE.lawyer)}</span>${date}<span>${a.minutes} min de leitura</span></p>
                ${a.preview ? `<p class="article-card__draft">Prévia — não publicado</p>` : ""}
                <a class="article-card__more" href="${a.url}" aria-label="Leia mais: ${esc(a.titulo)}">Leia mais ${icon("arrow", { size: 16 })}</a>
            </div>
        </article>`;
}

function articlesHero({ crumbs, kicker, title, text }) {
    const items = crumbs.map((c, i) => (i === crumbs.length - 1 ? `<li aria-current="page">${esc(c.label)}</li>` : `<li><a href="${c.href}">${esc(c.label)}</a></li>`)).join("");
    return `<section class="page-hero articles-hero">
            <div class="topo topo--dark" aria-hidden="true"></div>
            <div class="container page-hero__inner">
                <nav class="breadcrumbs" aria-label="Você está em"><ol>${items}</ol></nav>
                <p class="kicker">${kicker}</p>
                <h1>${title}</h1>
                ${text ? `<p class="page-hero__text">${text}</p>` : ""}
            </div>
        </section>`;
}

function personSchema(name) {
    if (!isLawyer(name)) return { "@type": "Person", name };
    return { "@type": "Person", "@id": `${SITE.url}/#advogado`, name: SITE.lawyer, url: abs("sobre.html"), jobTitle: "Advogado", identifier: SITE.oab, worksFor: { "@id": ORG_ID } };
}
const publisherSchema = { "@type": "Organization", "@id": ORG_ID, name: SITE.name, url: `${SITE.url}/`, logo: { "@type": "ImageObject", url: abs("assets/img/monograma-trigo.png") } };

// Listagem: /artigos/ e /artigos/pagina/N/
{
    const featured = ARTICLES.find((a) => a.destaque) || ARTICLES[0];
    const rest = ARTICLES.filter((a) => a !== featured);
    const pagesCount = Math.max(1, Math.ceil(rest.length / PER_PAGE));
    const usedCats = CATEGORIES.filter((c) => ARTICLES.some((a) => a.category?.slug === c.slug));
    const empty = ARTICLES.length === 0;
    for (let n = 1; n <= pagesCount; n++) {
        const slice = rest.slice((n - 1) * PER_PAGE, n * PER_PAGE);
        const urlPath = n === 1 ? "artigos/" : `artigos/pagina/${n}/`;
        const pageHref = (k) => (k === 1 ? "artigos/" : `artigos/pagina/${k}/`);
        const pager = pagesCount > 1
            ? `<nav class="pager" aria-label="Paginação dos artigos"><ul>
                ${n > 1 ? `<li><a class="pager__step" href="${pageHref(n - 1)}" rel="prev">${icon("chevronLeft", { size: 18 })}<span>Anteriores</span></a></li>` : ""}
                ${Array.from({ length: pagesCount }, (_, i) => i + 1).map((k) => `<li><a class="pager__num" href="${pageHref(k)}"${k === n ? ' aria-current="page"' : ""}>${k}</a></li>`).join("")}
                ${n < pagesCount ? `<li><a class="pager__step" href="${pageHref(n + 1)}" rel="next"><span>Próximos</span>${icon("chevronRight", { size: 18 })}</a></li>` : ""}
            </ul></nav>`
            : "";
        const controls = empty
            ? ""
            : `<div class="articles-controls">
                <label class="articles-search" for="artigos-busca">
                    ${icon("search", { size: 20 })}
                    <span class="visually-hidden">Pesquisar artigos</span>
                    <input id="artigos-busca" type="search" placeholder="Pesquisar artigos…" autocomplete="off" maxlength="80" data-articles-search>
                </label>
                <div class="articles-chips" role="group" aria-label="Filtrar artigos por categoria">
                    <button type="button" class="chip chip--light" aria-pressed="true" data-articles-filter="">Todas</button>
                    ${usedCats.map((c) => `<button type="button" class="chip chip--light" aria-pressed="false" data-articles-filter="${c.slug}">${esc(c.nome)}</button>`).join("")}
                </div>
                <p class="articles-count" role="status" aria-live="polite" data-articles-count></p>
            </div>`;
        const main = `
        ${articlesHero({
            crumbs: n === 1 ? [{ href: "index.html", label: "Início" }, { label: "Artigos" }] : [{ href: "index.html", label: "Início" }, { href: "artigos/", label: "Artigos" }, { label: `Página ${n}` }],
            kicker: "Conteúdo informativo",
            title: n === 1 ? "Artigos jurídicos" : `Artigos jurídicos — página ${n}`,
            text: "Textos de caráter informativo e educativo sobre temas jurídicos analisados pelo escritório. As informações não substituem a análise individual de cada caso.",
        })}
        <section class="section section--light articles" data-articles>
            <div class="container">
                ${controls}
                <div data-articles-static>
                    ${empty ? `<div class="articles-empty"><span class="articles-empty__icon">${icon("book", { size: 34, stroke: 1.25 })}</span><h2>Em breve, novos artigos.</h2><p>Os conteúdos estão em elaboração. Enquanto isso, conheça as <a href="index.html#areas">áreas de atuação</a> do escritório.</p></div>` : ""}
                    ${n === 1 && featured ? `<h2 class="articles-label">${featured.destaque ? "Em destaque" : "Mais recente"}</h2>${articleCard(featured, { featured: true })}` : ""}
                    ${slice.length ? `<h2 class="articles-label">${n === 1 ? "Artigos recentes" : "Mais artigos"}</h2><div class="articles-grid">${slice.map((a) => articleCard(a)).join("\n")}</div>` : ""}
                    ${pager}
                </div>
                <div class="articles-grid" data-articles-results hidden></div>
                <div class="articles-pager" data-articles-pager hidden></div>
                <p class="articles-empty articles-empty--search" data-articles-empty hidden>Nenhum artigo encontrado. Tente outro termo ou escolha outra categoria.</p>
                <p class="legal-note">${SITE.disclaimer}</p>
            </div>
        </section>`;
        const pageArticles = n === 1 ? [featured, ...slice].filter(Boolean) : slice;
        pages.push({
            file: n === 1 ? "artigos/index.html" : `artigos/pagina/${n}/index.html`,
            urlPath,
            nested: true,
            fast: true,
            articlesCss: true,
            bodyClass: "artigos",
            navKey: "artigos",
            fullTitle: n === 1 ? `Artigos jurídicos | ${SITE.name}` : `Artigos jurídicos — página ${n} | ${SITE.name}`,
            description: ARTICLES_DESC,
            message: SITE.defaultMessage,
            noindex: empty || WITH_DRAFTS,
            sitemap: n === 1 && !empty,
            lastmod: empty ? undefined : ARTICLES.map(lastmodOf).sort().at(-1),
            jsonld: [
                {
                    "@context": "https://schema.org",
                    "@type": "CollectionPage",
                    "@id": `${abs(urlPath)}#pagina`,
                    name: "Artigos jurídicos",
                    description: ARTICLES_DESC,
                    url: abs(urlPath),
                    inLanguage: "pt-BR",
                    isPartOf: { "@type": "WebSite", name: SITE.name, url: `${SITE.url}/` },
                    publisher: publisherSchema,
                    mainEntity: { "@type": "ItemList", itemListElement: pageArticles.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: abs(a.url), name: a.titulo })) },
                },
                {
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    itemListElement: [
                        { "@type": "ListItem", position: 1, name: "Início", item: `${SITE.url}/` },
                        { "@type": "ListItem", position: 2, name: "Artigos jurídicos", item: abs("artigos/") },
                        ...(n > 1 ? [{ "@type": "ListItem", position: 3, name: `Página ${n}`, item: abs(urlPath) }] : []),
                    ],
                },
            ],
            main,
        });
    }
}

// Páginas individuais
function relatedOf(a) {
    const others = ARTICLES.filter((o) => o !== a);
    const score = (o) => (o.category?.slug === a.category?.slug ? 2 : 0) + (o.areaList.some((s) => a.areaList.includes(s)) ? 1 : 0);
    return others.map((o) => [o, score(o)]).filter(([, s]) => s > 0).sort((x, y) => y[1] - x[1]).map(([o]) => o).concat(others).filter((o, i, arr) => arr.indexOf(o) === i).slice(0, 3);
}

function shareBlock(a) {
    const url = abs(a.url);
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(a.titulo);
    const links = [
        ["whatsapp", "WhatsApp", `https://wa.me/?text=${encodeURIComponent(`${a.titulo} — ${url}`)}`],
        ["linkedin", "LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
        ["facebook", "Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`],
        ["x", "X (Twitter)", `https://twitter.com/intent/tweet?url=${u}&text=${t}`],
        ["email", "E-mail", `mailto:?subject=${t}&body=${encodeURIComponent(`${a.titulo}\n${url}`)}`],
    ];
    return `<div class="article-share" aria-labelledby="compartilhar-titulo">
            <p class="article-share__title" id="compartilhar-titulo">${icon("share", { size: 18 })} Compartilhe este artigo</p>
            <ul>
                ${links.map(([id, label, href]) => `<li><a class="share-btn" href="${esc(href)}"${id === "email" ? "" : ' target="_blank" rel="noopener noreferrer"'} data-share="${id}">${label}<span class="visually-hidden"> (abre em nova janela)</span></a></li>`).join("")}
                <li><button type="button" class="share-btn" data-share="copiar" data-url="${esc(url)}" hidden>${icon("link", { size: 16 })}<span>Copiar link</span></button></li>
            </ul>
        </div>`;
}

// Informações institucionais e canais de contato (o CTA principal fica no rodapé).
function officeContact(a, message) {
    return `<ul class="article-contact__list">
                    <li>${icon("phone", { size: 18 })}<span>Telefone: <a href="${SITE.phoneHref}" class="js-phone">${SITE.phoneDisplay}</a> · <a class="js-wa" href="${esc(wa(message))}" target="_blank" rel="noopener" data-track="artigo-${a.slug}">WhatsApp</a></span></li>
                    <li>${icon("clock", { size: 18 })}<span>${SITE.hours}</span></li>
                    <li>${icon("pin", { size: 18 })}<span>${SITE.addressLine}</span></li>
                </ul>
                <p class="author-box__note">${SITE.noContract}</p>`;
}

function authorBox(a, message) {
    if (!isLawyer(a.autor)) {
        return `<aside class="author-box" aria-label="Autor"><div><p class="author-box__label">Autor</p><p class="author-box__name">${esc(a.autor)}</p></div></aside>
        <aside class="author-box" aria-label="Escritório"><div><p class="author-box__label">Escritório</p><p class="author-box__name">${SITE.name}</p>${officeContact(a, message)}</div></aside>`;
    }
    return `<aside class="author-box" aria-label="Advogado responsável">
            ${picture("dr-alexandre-retrato", { alt: `Retrato do ${SITE.lawyer}`, sizes: "96px", cls: "author-box__photo" })}
            <div>
                <p class="author-box__label">Advogado responsável</p>
                <p class="author-box__name"><a href="sobre.html" rel="author">${SITE.lawyer}</a></p>
                <p class="author-box__meta">${SITE.oab} · ${SITE.title.charAt(0).toUpperCase()}${SITE.title.slice(1)} · ${SITE.name}</p>
                ${officeContact(a, message)}
            </div>
        </aside>`;
}

function tocBlock(a) {
    const h2s = a.headings.filter((h) => h.level === 2);
    if (h2s.length < 3) return "";
    const items = [];
    for (const h of a.headings) {
        if (h.level === 2) items.push({ ...h, children: [] });
        else if (items.length) items.at(-1).children.push(h);
    }
    if (a.referencias.length) items.push({ id: "referencias", text: "Referências", children: [] });
    const li = (h) => `<li><a href="#${h.id}">${esc(h.text)}</a>${h.children?.length ? `<ol>${h.children.map(li).join("")}</ol>` : ""}</li>`;
    return `<nav class="article-toc" aria-labelledby="sumario-titulo" data-toc>
            <details open>
                <summary><span id="sumario-titulo">${icon("list", { size: 18 })} Neste artigo</span></summary>
                <ol>${items.map(li).join("")}</ol>
            </details>
        </nav>`;
}

for (const a of ARTICLES) {
    const url = abs(a.url);
    const cat = a.category;
    const area = areaBySlug[cat?.area] || areaBySlug[a.areaList[0]];
    const published = a.published ? `<time datetime="${a.published.toISOString()}">${formatDate(a.published)}</time>` : "sem data";
    const ogImg = a.social || a.cover;
    const related = relatedOf(a);
    const toc = tocBlock(a);
    const refs = a.referencias.length
        ? `<section class="article-refs" aria-labelledby="referencias"><h2 id="referencias">Referências</h2><ol>${a.referencias.map((r) => `<li>${r.link ? `<a href="${esc(r.link)}"${/^https?:/.test(r.link) ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(r.texto)}</a>` : esc(r.texto)}</li>`).join("")}</ol></section>`
        : "";
    const areasHtml = a.areaList.length
        ? `<section class="article-areas" aria-labelledby="areas-relacionadas"><h2 id="areas-relacionadas" class="article-areas__title">Área de atuação relacionada</h2>
            <ul class="other-areas other-areas--compact">${a.areaList.map((s) => areaBySlug[s]).map((o) => `<li><a class="other-area" href="${o.slug}.html" data-area-link="${o.slug}"><span class="other-area__icon">${icon(o.icon, { size: 24 })}</span><span class="other-area__name">${o.crumb || o.name}</span>${icon("arrowUpRight", { size: 18, cls: "icon other-area__arrow" })}</a></li>`).join("")}</ul></section>`
        : "";
    const main = `
        <article class="article" data-article data-slug="${a.slug}" data-category="${cat?.slug || ""}">
            <header class="page-hero article-hero">
                <div class="topo topo--dark" aria-hidden="true"></div>
                <div class="container page-hero__inner article-hero__inner">
                    <nav class="breadcrumbs" aria-label="Você está em"><ol><li><a href="index.html">Início</a></li><li><a href="artigos/">Artigos</a></li><li aria-current="page">${esc(a.titulo)}</li></ol></nav>
                    ${a.preview ? `<p class="article-draft-banner">Prévia — este conteúdo ainda não está publicado (${a.status === "rascunho" ? "rascunho" : "agendado"}).</p>` : ""}
                    ${cat ? `<p class="kicker"><a href="artigos/?categoria=${cat.slug}">${esc(cat.nome)}</a></p>` : ""}
                    <h1>${esc(a.titulo)}</h1>
                    ${a.resumo ? `<p class="page-hero__text">${esc(a.resumo)}</p>` : ""}
                    <ul class="article-meta">
                        <li>${icon("user", { size: 18 })}<span>Por ${isLawyer(a.autor) ? `<a href="sobre.html" rel="author">${SITE.lawyer}</a> · ${SITE.oab}` : esc(a.autor)}</span></li>
                        <li>${icon("calendar", { size: 18 })}<span>Publicado em ${published}</span></li>
                        ${a.updated ? `<li>${icon("calendar", { size: 18 })}<span>Atualizado em <time datetime="${a.updated.toISOString()}">${formatDate(a.updated)}</time></span></li>` : ""}
                        <li>${icon("clock", { size: 18 })}<span>${a.minutes} min de leitura</span></li>
                    </ul>
                </div>
            </header>
            ${a.cover ? `<figure class="article-cover container">${pictureHtml(a.cover, { alt: a.capaAlt || "", sizes: "(min-width: 1240px) 1160px, 94vw", eager: true })}</figure>` : ""}
            <div class="section section--light article-wrap${a.cover ? " article-wrap--cover" : ""}">
                <div class="container article-layout${toc ? "" : " article-layout--single"}">
                    ${toc ? `<aside class="article-aside">${toc}</aside>` : ""}
                    <div class="article-main">
                        <div class="article-body" data-article-body>
${a.html}
                        </div>
                        ${refs}
                        <p class="legal-note article-disclaimer">${SITE.disclaimer}</p>
                        <span data-article-end aria-hidden="true"></span>
                        ${shareBlock(a)}
                        ${authorBox(a, area?.message || SITE.defaultMessage)}
                        ${areasHtml}
                    </div>
                </div>
            </div>
        </article>
        ${related.length ? `<section class="section section--cream related" aria-labelledby="relacionados">
            <div class="container">
                <div class="section-head"><p class="kicker">Continue lendo</p><h2 id="relacionados">Artigos relacionados</h2></div>
                <div class="articles-grid">${related.map((r) => articleCard(r)).join("\n")}</div>
                <p class="related__all"><a class="text-link" href="artigos/">Ver todos os artigos ${icon("arrow", { size: 18 })}</a></p>
            </div>
        </section>` : ""}`;

    const metaTitle = a.seoTitle || a.titulo;
    const description = a.seoDescription || a.resumo || ARTICLES_DESC;
    const image = ogImg ? { url: abs(ogImg.large ? ogImg.large.replace(/^\//, "") : ogImg.src.replace(/^\//, "")), width: ogImg.largeWidth, height: ogImg.largeHeight, alt: a.capaAlt || a.titulo } : null;
    pages.push({
        file: `artigos/${a.slug}/index.html`,
        urlPath: a.url,
        nested: true,
        fast: true,
        articlesCss: true,
        bodyClass: "artigo",
        navKey: "artigos",
        fullTitle: `${metaTitle} | ${SITE.name}`,
        description,
        ogTitle: metaTitle,
        ogDescription: description,
        ogType: "article",
        ogImage: image || undefined,
        author: a.autor || SITE.lawyer,
        message: area?.message || SITE.defaultMessage,
        noindex: a.preview || !a.indexable,
        sitemap: !a.preview && a.indexable,
        lastmod: lastmodOf(a),
        extraHead: [
            a.published ? `<meta property="article:published_time" content="${a.published.toISOString()}">` : "",
            `<meta property="article:modified_time" content="${(a.updated || a.published || NOW).toISOString()}">`,
            cat ? `<meta property="article:section" content="${esc(cat.nome)}">` : "",
        ].filter(Boolean).map((l) => `${l}\n    `).join(""),
        jsonld: [
            {
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                "@id": `${url}#artigo`,
                mainEntityOfPage: { "@type": "WebPage", "@id": url },
                headline: a.titulo.slice(0, 110),
                description,
                image: image ? [image.url] : [abs("assets/img/og-alexandre-campos-puchetti.jpg")],
                datePublished: a.published?.toISOString(),
                dateModified: (a.updated || a.published)?.toISOString(),
                author: personSchema(a.autor),
                publisher: publisherSchema,
                articleSection: cat?.nome,
                inLanguage: "pt-BR",
                wordCount: a.words,
                isAccessibleForFree: true,
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Início", item: `${SITE.url}/` },
                    { "@type": "ListItem", position: 2, name: "Artigos jurídicos", item: abs("artigos/") },
                    { "@type": "ListItem", position: 3, name: a.titulo, item: url },
                ],
            },
        ],
        main,
    });

    // Endereços antigos: página de redirecionamento imediato (tratada pelo Google como permanente).
    for (const old of a.oldSlugs) {
        if (ARTICLES.some((o) => o.slug === old)) continue;
        pages.push({ file: `artigos/${old}/index.html`, raw: redirectPage(url), sitemap: false });
    }
}

function redirectPage(to) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Endereço alterado | ${SITE.name}</title>
    <meta name="robots" content="noindex, follow">
    <link rel="canonical" href="${to}">
    <meta http-equiv="refresh" content="0; url=${to}">
</head>
<body><p>Este artigo mudou de endereço: <a href="${to}">${to}</a></p></body>
</html>
`;
}

// ---------- fundos topográficos ----------
function topoSvg(stroke, opacity) {
    // Curvas de nível geradas deterministicamente (soma de senoides por anel).
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const centers = [
        { x: 180, y: 160, rings: 11 },
        { x: 980, y: 620, rings: 13 },
        { x: 1240, y: 80, rings: 7 },
    ];
    const paths = [];
    for (const c of centers) {
        const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
        for (let k = 1; k <= c.rings; k++) {
            const base = 26 * k + 10;
            const pts = [];
            const N = 32;
            for (let i = 0; i < N; i++) {
                const t = (i / N) * Math.PI * 2;
                const r = base + base * 0.16 * Math.sin(2 * t + ph[0] + k * 0.12) + base * 0.08 * Math.sin(3 * t + ph[1]) + base * 0.05 * Math.sin(5 * t + ph[2] - k * 0.2);
                pts.push([c.x + r * Math.cos(t) * 1.35, c.y + r * Math.sin(t)]);
            }
            // Catmull-Rom fechado -> Bézier
            let d = `M${pts[0][0].toFixed(0)} ${pts[0][1].toFixed(0)}`;
            for (let i = 0; i < N; i++) {
                const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
                const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
                const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
                d += `C${c1[0].toFixed(0)} ${c1[1].toFixed(0)} ${c2[0].toFixed(0)} ${c2[1].toFixed(0)} ${p2[0].toFixed(0)} ${p2[1].toFixed(0)}`;
            }
            paths.push(`<path d="${d}Z"/>`);
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="1">${paths.join("")}</g></svg>`;
}

// ---------- escrita ----------
await mkdir(path.join(root, "assets/svg"), { recursive: true });
await writeFile(path.join(root, "assets/svg/topo-dark.svg"), topoSvg("#c9a45c", 0.16));
await writeFile(path.join(root, "assets/svg/topo-light.svg"), topoSvg("#1d3b2f", 0.09));

// Divide títulos com data-split em palavras (feito no build para não depender de JS
// e evitar "piscar" o texto). Também numera os itens de entrada do hero.
function postProcess(html) {
    html = html.replace(/<(h1|h2|p)([^>]*\sdata-split(?:="[^"]*")?[^>]*)>([^<]+)<\/\1>/g, (_, tag, attrs, text) => {
        const words = text.trim().split(/\s+/);
        const inner = words.map((w, i) => `<span class="w"><span class="w__i" style="--i:${i}">${w}</span></span>`).join(" ");
        return `<${tag}${attrs}>${inner}</${tag}>`;
    });
    let hi = 0;
    html = html.replace(/data-hero-item>/g, () => `data-hero-item style="--hi:${hi++}">`);
    let si = 0;
    html = html.replace(/data-seal>/g, () => `data-seal style="--si:${si++}">`);
    return html;
}

// O OneDrive às vezes bloqueia o arquivo por um instante: tenta novamente.
async function safeWrite(file, content) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await writeFile(file, content, "utf8");
        } catch (error) {
            if (attempt >= 6) throw error;
            await new Promise((r) => setTimeout(r, 250 * attempt));
        }
    }
}

// Páginas em subpastas (/artigos/...) usam caminhos a partir da raiz do site.
function absolutize(html) {
    const fix = (u) => (/^(?:[a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(u) || u === "" ? u : `/${u}`);
    return html.replace(/\s(href|src|srcset|data-src)="([^"]*)"/g, (_, attr, val) => {
        const out = attr === "srcset" ? val.split(",").map((part) => part.trim().replace(/^(\S+)/, (u) => fix(u))).join(", ") : fix(val);
        return ` ${attr}="${out}"`;
    });
}

// Recria a pasta /artigos a cada build: artigos despublicados ou excluídos deixam de existir.
await rm(path.join(root, "artigos"), { recursive: true, force: true });
for (const p of pages) {
    const file = path.join(root, p.file);
    await mkdir(path.dirname(file), { recursive: true });
    const html = p.raw || postProcess(layout(p));
    await safeWrite(file, p.nested ? absolutize(html) : html);
}

// Índice para a busca/filtro da página de artigos e agenda de publicações futuras.
const searchIndex = ARTICLES.map((a) => ({
    t: a.titulo,
    d: a.resumo,
    c: a.category?.slug || "",
    cn: a.category?.nome || "",
    u: `/${a.url}`,
    dt: a.published?.toISOString() || "",
    dl: a.published ? formatDate(a.published) : "",
    a: a.autor || SITE.lawyer,
    r: a.minutes,
    i: a.cover ? { s: a.cover.thumb || a.cover.fallback, w: a.cover.width, h: a.cover.height, alt: a.capaAlt || "" } : null,
    ic: categoryIcon(a.category),
}));
await safeWrite(path.join(root, "artigos/indice.json"), JSON.stringify(searchIndex));
await safeWrite(path.join(root, "artigos/agenda.json"), JSON.stringify(WITH_DRAFTS ? [] : content.scheduled.map((a) => a.published.toISOString())));
// Ícones das categorias para os cards gerados pela busca (mesmo SVG do build).
await safeWrite(path.join(root, "artigos/icones.json"), JSON.stringify(Object.fromEntries([...new Set(searchIndex.map((s) => s.ic))].map((n) => [n, icon(n, { size: 40, stroke: 1.25 })]))));

// Versiona os imports dos módulos JS (evita cache antigo após cada publicação).
// Todos os módulos usam a mesma versão para não haver instâncias duplicadas.
const { readdir } = await import("node:fs/promises");
const jsFiles = [path.join(root, "assets/js/main.js"), ...(await readdir(path.join(root, "assets/js/modules"))).filter((f) => f.endsWith(".js")).map((f) => path.join(root, "assets/js/modules", f))];
for (const file of jsFiles) {
    const src = await readFile(file, "utf8");
    const out = src.replace(/(from\s+["']\.{1,2}\/[^"']+?\.js)(\?v=\w+)?(["'])/g, `$1?v=${VERSION}$3`);
    if (out !== src) await safeWrite(file, out);
}

// Sitemap: somente URLs públicas, canônicas e indexáveis. O lastmod das páginas fixas vem de
// PAGES_LASTMOD (site-data.mjs) e o dos artigos, da data de atualização/publicação.
const isArticle = (f) => f.startsWith("artigos/");
const priority = (f) => (f === "index.html" ? "1.0" : AREAS.some((a) => `${a.slug}.html` === f) ? "0.8" : LEGAL_PAGES.some((l) => `${l.slug}.html` === f) ? "0.3" : f === "artigos/index.html" ? "0.7" : isArticle(f) ? "0.6" : "0.7");
const freq = (f) => (f === "index.html" || f === "artigos/index.html" ? "weekly" : LEGAL_PAGES.some((l) => `${l.slug}.html` === f) ? "yearly" : "monthly");
const sitemapPages = pages.filter((p) => !p.raw && !p.noindex && p.sitemap !== false && !WITH_DRAFTS);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapPages.map((p) => `  <url><loc>${canonicalOf(p)}</loc><lastmod>${p.lastmod || PAGES_LASTMOD}</lastmod><changefreq>${freq(p.file)}</changefreq><priority>${priority(p.file)}</priority></url>`).join("\n")}
</urlset>
`;
if (!WITH_DRAFTS) {
    await safeWrite(path.join(root, "sitemap.xml"), sitemap);
    await safeWrite(path.join(root, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${abs("sitemap.xml")}\n`);
}

const fmt = (list) => list.map((a) => `   - ${a.slug} (${a.file})`).join("\n");
console.log(`${pages.length} páginas geradas${WITH_DRAFTS ? " (PRÉVIA COM RASCUNHOS — não publique esta versão)" : " + sitemap.xml + robots.txt"}`);
console.log(`Artigos: ${content.published.length} publicado(s), ${content.scheduled.length} agendado(s), ${content.drafts.length} rascunho(s).`);
if (content.scheduled.length) console.log(` Agendados:\n${fmt(content.scheduled)}`);
for (const w of [...content.warnings, ...imageWarnings]) console.warn(` ! ${w}`);

// ---------- pacote de publicação (/dist) ----------
if (ARGS.has("--dist")) {
    if (WITH_DRAFTS) throw new Error("--dist não pode ser usado com --drafts.");
    const dist = path.join(root, "dist");
    await rm(dist, { recursive: true, force: true });
    await mkdir(dist, { recursive: true });
    const rootFiles = (await readDir(root)).filter((f) => /\.(html|txt|xml|webmanifest|ico|png)$/.test(f) && !f.startsWith("preview-"));
    for (const f of rootFiles) await cp(path.join(root, f), path.join(dist, f));
    // Pastas públicas. /content (rascunhos), /tools e /api nunca são copiados.
    for (const dir of ["assets", "artigos", "admin", "imagem"]) {
        await cp(path.join(root, dir), path.join(dist, dir), { recursive: true });
    }
    console.log(`Pacote de publicação gerado em /dist (${rootFiles.length} arquivos na raiz + assets, artigos, admin, imagem).`);
}
