// FAQ: acordeão com altura animada, busca e filtros por tema.
import { env, $, $$, track } from "./env.js?v=d507f9b5f9";

export function initFaq() {
    $$("[data-faq]").forEach((faq) => {
        const items = $$(".faq-item", faq);
        items.forEach(animateDetails);
        initFilters(faq, items);
    });
}

function animateDetails(details) {
    const summary = $("summary", details);
    const body = $(".faq-item__body", details);
    if (!summary || !body || env.reduceMotion || !body.animate) return;
    let anim = null;

    summary.addEventListener("click", (e) => {
        e.preventDefault();
        anim?.cancel();
        if (details.open) {
            const start = body.offsetHeight;
            anim = body.animate({ height: [`${start}px`, "0px"], opacity: [1, 0] }, { duration: 380, easing: "cubic-bezier(.65,0,.35,1)" });
            anim.onfinish = () => {
                details.open = false;
                anim = null;
            };
        } else {
            details.open = true;
            const end = body.offsetHeight;
            anim = body.animate({ height: ["0px", `${end}px`], opacity: [0, 1] }, { duration: 460, easing: "cubic-bezier(.16,1,.3,1)" });
            anim.onfinish = () => (anim = null);
            track("faq_open", { question: summary.textContent.trim() });
        }
    });
}

const normalize = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function initFilters(faq, items) {
    const input = $("[data-faq-search]", faq);
    const chips = $$("[data-faq-filter]", faq);
    const count = $("[data-faq-count]", faq);
    const empty = $("[data-faq-empty]", faq);
    if (!input && !chips.length) return;

    // Guarda o texto original para destacar o termo buscado
    items.forEach((item) => {
        const q = $("summary span", item);
        item._question = q;
        item._original = q.textContent;
        item._haystack = normalize(item.textContent);
    });

    let category = "todas";
    let timer;

    const apply = () => {
        const term = normalize(input?.value.trim() || "");
        let visible = 0;
        items.forEach((item) => {
            const matchCat = category === "todas" || item.dataset.cat === category;
            const matchTerm = !term || item._haystack.includes(term);
            const show = matchCat && matchTerm;
            item.hidden = !show;
            if (show) {
                visible++;
                item.classList.add("is-in");
            }
            highlight(item, term);
        });
        if (count) count.textContent = `${visible} ${visible === 1 ? "pergunta exibida" : "perguntas exibidas"}`;
        if (empty) empty.hidden = visible > 0;
    };

    chips.forEach((chip) => {
        chip.addEventListener("click", () => {
            category = chip.dataset.faqFilter;
            chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
            apply();
        });
    });

    input?.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            apply();
            if (input.value.trim().length > 2) track("faq_search", { term: input.value.trim() });
        }, 120);
    });

    apply();
}

function highlight(item, term) {
    const el = item._question;
    if (!term) {
        el.textContent = item._original;
        return;
    }
    const text = item._original;
    const idx = normalize(text).indexOf(term);
    if (idx < 0) {
        el.textContent = text;
        return;
    }
    el.textContent = "";
    el.append(text.slice(0, idx));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(idx, idx + term.length);
    el.append(mark, text.slice(idx + term.length));
}
