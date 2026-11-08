// Detecção de ambiente compartilhada pelos módulos.
const mq = (q) => window.matchMedia(q).matches;

export const env = {
    reduceMotion: mq("(prefers-reduced-motion: reduce)"),
    finePointer: mq("(hover: hover) and (pointer: fine)"),
    get desktop() {
        return mq("(min-width: 1024px)");
    },
    get gsap() {
        return window.gsap && window.ScrollTrigger ? window.gsap : null;
    },
};

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function track(event, params = {}) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, page_path: window.location.pathname, ...params });
}
