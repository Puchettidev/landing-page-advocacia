// Consentimento (LGPD) e Google Analytics 4.
// O GA4 só é carregado depois que o visitante aceita os cookies de medição.
// Sem ID de mensuração configurado no build, nada é exibido nem carregado.
import { $, $$ } from "./env.js?v=371857c65f";

const KEY = "acp-consent-v1";

function getChoice() {
    try {
        return localStorage.getItem(KEY);
    } catch {
        return null;
    }
}

function setChoice(value) {
    try {
        localStorage.setItem(KEY, value);
    } catch {
        /* armazenamento indisponível: vale só para esta página */
    }
}

let loaded = false;
function loadGa(id) {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
        window.dataLayer.push(arguments);
    };
    window.gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
    window.gtag("js", new Date());
    // page_view automático do GA4; nenhum dado pessoal é enviado nos eventos do site.
    window.gtag("config", id, { allow_google_signals: false, allow_ad_personalization_signals: false });
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.append(s);
    window.__acpAnalytics = true;
}

function removeGaCookies() {
    const host = window.location.hostname.replace(/^www\./, "");
    document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter((n) => n === "_ga" || n.startsWith("_ga_")).forEach((name) => {
        for (const domain of ["", `; domain=.${host}`, `; domain=${window.location.hostname}`]) document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
    });
}

function banner(onChoose) {
    const box = document.createElement("div");
    box.className = "cookie-consent";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-live", "polite");
    box.setAttribute("aria-label", "Preferências de cookies");
    box.innerHTML = `<p class="cookie-consent__text">Utilizamos cookies de medição (Google Analytics) para entender, de forma agregada, como o site é usado. Nenhum dado de contato ou relato de caso é enviado. Você pode aceitar ou recusar. <a href="/politica-de-privacidade.html">Política de Privacidade</a>.</p>
        <div class="cookie-consent__actions"><button type="button" class="btn btn-ghost-dark btn-sm" data-consent="denied">Recusar</button><button type="button" class="btn btn-gold btn-sm" data-consent="granted"><span class="btn__label">Aceitar</span></button></div>`;
    box.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-consent]");
        if (!btn) return;
        onChoose(btn.dataset.consent);
        box.remove();
    });
    document.body.append(box);
    return box;
}

export function initConsent() {
    const id = $('meta[name="ga-measurement-id"]')?.content;
    if (!id) return;
    const choose = (value) => {
        setChoice(value);
        if (value === "granted") loadGa(id);
        else {
            window.__acpAnalytics = false;
            if (window.gtag) window.gtag("consent", "update", { analytics_storage: "denied" });
            removeGaCookies();
        }
    };
    const choice = getChoice();
    if (choice === "granted") loadGa(id);
    else if (choice !== "denied") banner(choose);

    $$("[data-consent-open]").forEach((b) =>
        b.addEventListener("click", () => {
            $(".cookie-consent")?.remove();
            banner(choose);
        }),
    );
}
