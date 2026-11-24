// Artigos jurídicos: busca, filtro por categoria e paginação da listagem;
// sumário ativo, compartilhamento e eventos de leitura na página do artigo.
import { $, $$, track } from "./env.js?v=371857c65f";

const PER_PAGE = 9;
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === "text") node.textContent = v;
        else node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of [].concat(children)) if (c) node.append(c);
    return node;
}

function card(item, icons) {
    let media;
    if (item.i) {
        media = el("img", { src: item.i.s, alt: item.i.alt || "", width: item.i.w, height: item.i.h, loading: "lazy", decoding: "async" });
    } else {
        media = el("span", { class: "article-ph", "aria-hidden": "true" }, [el("span", { class: "article-ph__topo" })]);
        // SVG gerado no build (conteúdo próprio do site, não vem do usuário)
        media.insertAdjacentHTML("beforeend", icons[item.ic] || "");
    }
    const meta = el("p", { class: "article-card__meta" }, [el("span", { text: item.a }), item.dt ? el("time", { datetime: item.dt, text: item.dl }) : null, el("span", { text: `${item.r} min de leitura` })]);
    return el("article", { class: "article-card", "data-cat": item.c }, [
        el("a", { class: "article-card__media", href: item.u, tabindex: "-1", "aria-hidden": "true" }, media),
        el("div", { class: "article-card__body" }, [
            item.cn ? el("p", { class: "article-card__cat", text: item.cn }) : null,
            el("h3", { class: "article-card__title" }, el("a", { href: item.u, text: item.t })),
            item.d ? el("p", { class: "article-card__excerpt", text: item.d }) : null,
            meta,
            el("a", { class: "article-card__more", href: item.u, "aria-label": `Leia mais: ${item.t}`, text: "Leia mais →" }),
        ]),
    ]);
}

function initListing(root) {
    const input = $("[data-articles-search]", root);
    const chips = $$("[data-articles-filter]", root);
    const staticBox = $("[data-articles-static]", root);
    const results = $("[data-articles-results]", root);
    const pager = $("[data-articles-pager]", root);
    const empty = $("[data-articles-empty]", root);
    const count = $("[data-articles-count]", root);
    if (!input || !results) return;

    let data = null;
    let icons = {};
    let loading = null;
    let category = "";
    let page = 1;
    let timer;

    const load = () =>
        (loading ||= Promise.all([
            fetch("/artigos/indice.json").then((r) => (r.ok ? r.json() : [])),
            fetch("/artigos/icones.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
        ]).then(([d, i]) => {
            data = d.map((x) => ({ ...x, _s: norm(`${x.t} ${x.d} ${x.cn}`) }));
            icons = i;
        }).catch(() => {
            data = [];
        }));

    function setChip(slug) {
        category = slug;
        chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.articlesFilter === slug)));
    }

    function syncUrl() {
        const url = new URL(window.location.href);
        if (category) url.searchParams.set("categoria", category);
        else url.searchParams.delete("categoria");
        history.replaceState(null, "", url);
    }

    async function apply({ resetPage = true } = {}) {
        const term = norm(input.value.trim());
        if (resetPage) page = 1;
        if (!term && !category) {
            staticBox.hidden = false;
            results.hidden = pager.hidden = empty.hidden = true;
            count.textContent = "";
            return;
        }
        await load();
        const words = term.split(/\s+/).filter(Boolean);
        const list = data.filter((x) => (!category || x.c === category) && words.every((w) => x._s.includes(w)));
        const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
        page = Math.min(page, pages);
        staticBox.hidden = true;
        results.replaceChildren(...list.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((x) => card(x, icons)));
        results.hidden = list.length === 0;
        empty.hidden = list.length !== 0;
        count.textContent = list.length === 1 ? "1 artigo encontrado" : `${list.length} artigos encontrados`;
        pager.replaceChildren();
        pager.hidden = pages <= 1;
        if (pages > 1) {
            const btn = (label, target, attrs = {}) => {
                const b = el("button", { type: "button", ...attrs, text: label });
                b.addEventListener("click", () => {
                    page = target;
                    apply({ resetPage: false });
                    root.scrollIntoView({ behavior: "smooth", block: "start" });
                });
                return b;
            };
            pager.append(btn("Anteriores", page - 1, { disabled: page === 1, "aria-label": "Página anterior" }));
            for (let k = 1; k <= pages; k++) pager.append(btn(String(k), k, { "aria-current": k === page ? "page" : null, "aria-label": `Página ${k}` }));
            pager.append(btn("Próximos", page + 1, { disabled: page === pages, "aria-label": "Próxima página" }));
        }
    }

    input.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            apply();
            // Apenas o fato de ter havido busca (o termo digitado não é enviado ao Analytics).
            if (input.value.trim().length > 2) track("article_search");
        }, 220);
    });
    input.addEventListener("focus", load, { once: true });
    chips.forEach((chip) =>
        chip.addEventListener("click", () => {
            setChip(chip.dataset.articlesFilter);
            syncUrl();
            apply();
            if (category) track("article_filter", { article_category: category });
        }),
    );

    const initial = new URLSearchParams(window.location.search).get("categoria");
    if (initial && chips.some((c) => c.dataset.articlesFilter === initial)) {
        setChip(initial);
        apply();
    }
}

function initArticle(article) {
    const slug = article.dataset.slug;
    const cat = article.dataset.category;
    track("article_view", { article_slug: slug, article_category: cat });

    // Leitura até o fim (uma vez por página)
    const end = $("[data-article-end]", article);
    if (end && "IntersectionObserver" in window) {
        const io = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) {
                track("article_read_complete", { article_slug: slug, article_category: cat });
                io.disconnect();
            }
        });
        io.observe(end);
    }

    // Do artigo para as páginas de atuação
    $$("[data-area-link]", article).forEach((a) => a.addEventListener("click", () => track("article_area_click", { article_slug: slug, area: a.dataset.areaLink })));

    // Compartilhamento
    $$("[data-share]", article).forEach((btn) => {
        const method = btn.dataset.share;
        if (method === "copiar") {
            btn.hidden = !navigator.clipboard;
            btn.addEventListener("click", async () => {
                try {
                    await navigator.clipboard.writeText(btn.dataset.url);
                    const label = btn.querySelector("span");
                    const old = label.textContent;
                    label.textContent = "Link copiado";
                    setTimeout(() => (label.textContent = old), 2200);
                } catch {
                    /* sem permissão: nada a fazer */
                }
                track("share_click", { method, article_slug: slug });
            });
            return;
        }
        btn.addEventListener("click", () => track("share_click", { method, article_slug: slug }));
    });

    // Sumário: destaca a seção em leitura
    const toc = $("[data-toc]");
    if (toc && "IntersectionObserver" in window) {
        const links = new Map($$("a[href^='#']", toc).map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
        const targets = [...links.keys()].map((id) => document.getElementById(id)).filter(Boolean);
        const io = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                if (!visible) return;
                links.forEach((a) => a.classList.remove("is-active"));
                links.get(visible.target.id)?.classList.add("is-active");
            },
            { rootMargin: "-20% 0px -70% 0px" },
        );
        targets.forEach((t) => io.observe(t));
        // No celular o sumário começa recolhido para não empurrar o texto
        if (window.matchMedia("(max-width: 1100px)").matches) $("details", toc)?.removeAttribute("open");
    }
}

export function initArticles() {
    const listing = $("[data-articles]");
    if (listing) initListing(listing);
    const article = $("[data-article]");
    if (article) initArticle(article);
}
