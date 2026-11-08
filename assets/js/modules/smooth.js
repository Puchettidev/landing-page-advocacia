// Rolagem suave (Lenis) integrada ao ScrollTrigger + âncoras internas.
import { env, $$ } from "./env.js?v=d507f9b5f9";

export let lenis = null;

export function initSmoothScroll() {
    const gsap = env.gsap;

    if (!env.reduceMotion && window.Lenis) {
        lenis = new window.Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
        if (gsap) {
            lenis.on("scroll", window.ScrollTrigger.update);
            gsap.ticker.add((time) => lenis.raf(time * 1000));
            gsap.ticker.lagSmoothing(0);
        } else {
            const raf = (time) => {
                lenis.raf(time);
                requestAnimationFrame(raf);
            };
            requestAnimationFrame(raf);
        }
    }

    // Chegada com âncora (ex.: index.html#faq vindo de outra página)
    if (window.location.hash) {
        const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
        if (target) {
            if ("scrollRestoration" in history) history.scrollRestoration = "manual";
            const go = () => setTimeout(() => {
                window.ScrollTrigger?.refresh();
                scrollToTarget(target, { focus: false, immediate: true });
            }, 350);
            if (document.readyState === "complete") go();
            else window.addEventListener("load", go, { once: true });
        }
    }

    // Âncoras da própria página (inclui links "index.html#areas" quando já estamos na home)
    $$('a[href*="#"]').forEach((link) => {
        link.addEventListener("click", (event) => {
            const url = new URL(link.href, window.location.href);
            const norm = (p) => p.replace(/index\.html$/, "");
            if (norm(url.pathname) !== norm(window.location.pathname) || !url.hash) return;
            const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
            if (!target) return;
            event.preventDefault();
            scrollToTarget(target);
            history.pushState(null, "", url.hash);
        });
    });
}

export function scrollToTarget(target, { focus = true, immediate = false } = {}) {
    const offset = -(parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-h"), 10) || 80) + 4;
    if (lenis) {
        lenis.scrollTo(target, { offset, duration: 1.4, immediate });
    } else {
        const top = target.getBoundingClientRect().top + window.scrollY + offset;
        window.scrollTo({ top, behavior: env.reduceMotion || immediate ? "auto" : "smooth" });
    }
    // Move o foco para o destino (acessibilidade de teclado)
    if (!focus) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
}
