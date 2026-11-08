// Header (sólido ao rolar, esconde ao descer), barra de progresso e menu mobile.
import { $, $$ } from "./env.js?v=115b962aea";
import { lenis } from "./smooth.js?v=115b962aea";

export function initHeader() {
    const header = $("[data-header]");
    if (!header) return;
    const progress = $(".read-progress", header);
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        header.classList.toggle("is-scrolled", y > 24);
        if (!document.body.classList.contains("menu-open")) {
            header.classList.toggle("is-hidden", y > lastY && y > 480);
        }
        progress?.style.setProperty("--progress", max > 0 ? (y / max).toFixed(4) : 0);
        lastY = y;
        ticking = false;
    };

    window.addEventListener("scroll", () => {
        if (!ticking) {
            requestAnimationFrame(update);
            ticking = true;
        }
    }, { passive: true });
    update();

    // Mostra o header quando algo dentro dele recebe foco pelo teclado
    header.addEventListener("focusin", () => header.classList.remove("is-hidden"));

    // Destaque da seção ativa no menu (apenas na home)
    const sections = $$("main section[id]");
    const navLinks = $$(".main-nav a");
    if ("IntersectionObserver" in window && sections.length) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                navLinks.forEach((a) => {
                    const hash = new URL(a.href).hash.slice(1);
                    a.classList.toggle("is-active", hash && hash === entry.target.id);
                });
            });
        }, { rootMargin: "-45% 0px -50% 0px" });
        sections.forEach((s) => io.observe(s));
    }

    initMobileMenu(header);
}

function initMobileMenu(header) {
    const toggle = $(".menu-toggle", header);
    const menu = $("#mobile-menu");
    if (!toggle || !menu) return;

    let closeTimer;
    const open = () => {
        clearTimeout(closeTimer);
        menu.hidden = false;
        requestAnimationFrame(() => menu.classList.add("is-open"));
        document.body.classList.add("menu-open");
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Fechar menu");
        lenis?.stop();
        $("a", menu)?.focus({ preventScroll: true });
    };
    const close = ({ restoreFocus = true } = {}) => {
        menu.classList.remove("is-open");
        document.body.classList.remove("menu-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Abrir menu");
        lenis?.start();
        closeTimer = setTimeout(() => (menu.hidden = true), 700);
        if (restoreFocus) toggle.focus({ preventScroll: true });
    };

    toggle.addEventListener("click", () => (menu.classList.contains("is-open") ? close() : open()));
    $$("a", menu).forEach((a) => a.addEventListener("click", () => close({ restoreFocus: false })));
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && menu.classList.contains("is-open")) close();
        // Mantém o foco dentro do menu aberto
        if (e.key === "Tab" && menu.classList.contains("is-open")) {
            const focusables = [toggle, ...$$("a, button", menu)];
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });
    window.matchMedia("(min-width: 1101px)").addEventListener("change", (e) => {
        if (e.matches && menu.classList.contains("is-open")) close({ restoreFocus: false });
    });
}
