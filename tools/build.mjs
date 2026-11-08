// Gera as páginas HTML estáticas do site a partir de site-data.mjs.
// Uso: cd tools && npm run build   (não precisa de dependências)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, AREAS, FAQ, FAQ_CATEGORIES, VALUES, STEPS_HOME, STEPS_ABOUT, GUIDANCE, GALLERY, DIFFERENTIALS, LEGAL_PAGES } from "./site-data.mjs";
import { icon, WHATSAPP_SVG } from "./icons.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "assets/img/manifest.json"), "utf8"));
const TODAY = new Date().toISOString().slice(0, 10);

// Versão = hash do conteúdo de CSS/JS (muda só quando algo muda de fato).
const { createHash } = await import("node:crypto");
const { readdir: listDir } = await import("node:fs/promises");
const assetSources = [
    path.join(root, "assets/css/main.css"),
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
    const canonical = abs(page.file === "index.html" ? "" : page.file);
    const ogImage = abs("assets/img/og-alexandre-campos-puchetti.jpg");
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${page.file === "index.html" ? `<meta name="google-site-verification" content="${SITE.googleVerification}">\n    ` : ""}<title>${esc(title)}</title>
    <meta name="description" content="${esc(page.description)}">
    <meta name="robots" content="index, follow">
    <meta name="author" content="${SITE.name}">
    <meta name="theme-color" content="#07130f">
    <link rel="canonical" href="${canonical}">
    <meta property="og:locale" content="pt_BR">
    <meta property="og:site_name" content="${SITE.name}">
    <meta property="og:type" content="${page.ogType || "website"}">
    <meta property="og:title" content="${esc(page.ogTitle || title)}">
    <meta property="og:description" content="${esc(page.ogDescription || page.description)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${SITE.lawyer} em seu escritório em Muriaé/MG">
    <meta name="twitter:card" content="summary_large_image">
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
    <link rel="stylesheet" href="assets/css/main.css?v=${VERSION}">
    <script>
        (function () {
            var d = document.documentElement, reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            d.classList.add("js");
            if (reduce) d.classList.add("reduce-motion");
            try {
                if (!reduce && !sessionStorage.getItem("acp-visited")) d.classList.add("show-preloader");
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

for (const p of pages) {
    await safeWrite(path.join(root, p.file), postProcess(layout(p)));
}

// Versiona os imports dos módulos JS (evita cache antigo após cada publicação).
// Todos os módulos usam a mesma versão para não haver instâncias duplicadas.
const { readdir } = await import("node:fs/promises");
const jsFiles = [path.join(root, "assets/js/main.js"), ...(await readdir(path.join(root, "assets/js/modules"))).filter((f) => f.endsWith(".js")).map((f) => path.join(root, "assets/js/modules", f))];
for (const file of jsFiles) {
    const src = await readFile(file, "utf8");
    const out = src.replace(/(from\s+["']\.{1,2}\/[^"']+?\.js)(\?v=\w+)?(["'])/g, `$1?v=${VERSION}$3`);
    if (out !== src) await safeWrite(file, out);
}

const priority = (f) => (f === "index.html" ? "1.0" : AREAS.some((a) => `${a.slug}.html` === f) ? "0.8" : LEGAL_PAGES.some((l) => `${l.slug}.html` === f) ? "0.3" : "0.7");
const freq = (f) => (f === "index.html" ? "weekly" : LEGAL_PAGES.some((l) => `${l.slug}.html` === f) ? "yearly" : "monthly");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${abs(p.file === "index.html" ? "" : p.file)}</loc><lastmod>${TODAY}</lastmod><changefreq>${freq(p.file)}</changefreq><priority>${priority(p.file)}</priority></url>`).join("\n")}
</urlset>
`;
await writeFile(path.join(root, "sitemap.xml"), sitemap, "utf8");
console.log(`${pages.length} páginas geradas + sitemap.xml`);
