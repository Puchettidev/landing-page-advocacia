// Ponto de entrada. Cada módulo é inicializado de forma isolada: se um falhar,
// os demais continuam funcionando e o conteúdo permanece legível.
import { initSmoothScroll } from "./modules/smooth.js?v=d507f9b5f9";
import { initHeader } from "./modules/header.js?v=d507f9b5f9";
import { initReveal } from "./modules/reveal.js?v=d507f9b5f9";
import { initButtons, initCards, initMarquee } from "./modules/interactions.js?v=d507f9b5f9";
import { initScrollEffects } from "./modules/scroll-effects.js?v=d507f9b5f9";
import { initGallery } from "./modules/gallery.js?v=d507f9b5f9";
import { initFaq } from "./modules/faq.js?v=d507f9b5f9";
import { initForm } from "./modules/form.js?v=d507f9b5f9";
import { initMap, initWhatsApp, initPageTransitions } from "./modules/misc.js?v=d507f9b5f9";

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
