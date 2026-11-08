// Ponto de entrada. Cada módulo é inicializado de forma isolada: se um falhar,
// os demais continuam funcionando e o conteúdo permanece legível.
import { initSmoothScroll } from "./modules/smooth.js?v=115b962aea";
import { initHeader } from "./modules/header.js?v=115b962aea";
import { initReveal } from "./modules/reveal.js?v=115b962aea";
import { initButtons, initCards, initMarquee } from "./modules/interactions.js?v=115b962aea";
import { initScrollEffects } from "./modules/scroll-effects.js?v=115b962aea";
import { initGallery } from "./modules/gallery.js?v=115b962aea";
import { initFaq } from "./modules/faq.js?v=115b962aea";
import { initForm } from "./modules/form.js?v=115b962aea";
import { initMap, initWhatsApp, initPageTransitions } from "./modules/misc.js?v=115b962aea";

const root = document.documentElement;
if (!root.classList.contains("anim-failed")) root.classList.add("anim-ready");

const modules = [initSmoothScroll, initHeader, initReveal, initButtons, initCards, initMarquee, initScrollEffects, initGallery, initFaq, initForm, initMap, initWhatsApp, initPageTransitions];

for (const init of modules) {
    try {
        init();
    } catch (error) {
        console.warn(`[site] falha ao iniciar ${init.name}`, error);
    }
}
