// Mapa sob demanda, WhatsApp flutuante (horário de atendimento), rastreamento
// de cliques e transição suave entre páginas.
import { env, $, $$, track } from "./env.js?v=d507f9b5f9";

export function initMap() {
    $$("[data-map]").forEach((frame) => {
        const load = () => {
            if (frame.querySelector("iframe")) return;
            const iframe = document.createElement("iframe");
            iframe.title = "Mapa do escritório Alexandre Campos Puchetti Advocacia em Muriaé/MG";
            iframe.src = frame.dataset.src;
            iframe.loading = "lazy";
            iframe.referrerPolicy = "no-referrer-when-downgrade";
            iframe.addEventListener("load", () => frame.querySelector(".map-frame__placeholder")?.remove());
            frame.append(iframe);
        };
        if (!("IntersectionObserver" in window)) return load();
        const io = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                load();
                io.disconnect();
            }
        }, { rootMargin: "400px 0px" });
        io.observe(frame);
    });
}

// Horário: 8h às 12h, segunda a sexta (horário de Brasília)
function officeStatus(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(now);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const day = get("weekday");
    const minutes = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
    const weekday = !["Sat", "Sun"].includes(day);
    return weekday && minutes >= 8 * 60 && minutes < 12 * 60;
}

export function initWhatsApp() {
    const float = $("[data-wa-float]");
    if (float) {
        const hours = $("[data-wa-hours]", float);
        const open = officeStatus();
        if (hours) {
            hours.innerHTML = "";
            const statusEl = document.createElement("span");
            statusEl.className = "wa-float__status";
            statusEl.style.setProperty("--status", open ? "#1f9d55" : "#b8862b");
            statusEl.textContent = open
                ? "Em horário de atendimento (seg–sex, 8h–12h)"
                : "Fora do horário: resposta no próximo período (seg–sex, 8h–12h).";
            hours.append(statusEl);
        }
        // Mostra o aviso uma vez por sessão, sem insistir
        let shown = false;
        try {
            shown = sessionStorage.getItem("acp-wa-tip") === "1";
            sessionStorage.setItem("acp-wa-tip", "1");
        } catch (err) {
            /* ignore */
        }
        if (!shown) {
            setTimeout(() => {
                float.classList.add("is-tip-visible");
                setTimeout(() => float.classList.remove("is-tip-visible"), 6000);
            }, 4500);
        }
    }

    $$(".js-wa").forEach((link) => {
        link.addEventListener("click", () => track("whatsapp_click", { origem: link.dataset.track || link.textContent.trim().slice(0, 60) }));
    });
    $$(".js-phone").forEach((link) => link.addEventListener("click", () => track("phone_click")));
}

export function initPageTransitions() {
    if (env.reduceMotion) return;

    document.addEventListener("click", (e) => {
        const link = e.target.closest("a");
        if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (link.target === "_blank" || link.hasAttribute("download")) return;
        const url = new URL(link.href, window.location.href);
        if (url.origin !== window.location.origin || !/\.html$|\/$/.test(url.pathname)) return;
        const samePage = (p) => p.replace(/index\.html$/, "");
        if (samePage(url.pathname) === samePage(window.location.pathname)) return; // âncora na mesma página
        e.preventDefault();
        try {
            sessionStorage.setItem("acp-transition", "1");
        } catch (err) {
            /* sem storage: segue sem transição de entrada */
        }
        document.documentElement.classList.add("is-leaving");
        setTimeout(() => (window.location.href = url.href), 420);
    });

    // Ao voltar pelo histórico (bfcache), remove a cortina
    window.addEventListener("pageshow", (e) => {
        if (e.persisted) document.documentElement.classList.remove("is-leaving", "page-enter");
    });
}
