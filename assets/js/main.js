// Ponto de entrada. Cada módulo é inicializado de forma isolada: se um falhar,
// os demais continuam funcionando e o conteúdo permanece legível.
import { initSmoothScroll } from "./modules/smooth.js?v=371857c65f";
import { initHeader } from "./modules/header.js?v=371857c65f";
import { initReveal } from "./modules/reveal.js?v=371857c65f";
import { initButtons, initCards, initMarquee } from "./modules/interactions.js?v=371857c65f";
import { initScrollEffects } from "./modules/scroll-effects.js?v=371857c65f";
import { initGallery } from "./modules/gallery.js?v=371857c65f";
import { initFaq } from "./modules/faq.js?v=371857c65f";
import { initForm } from "./modules/form.js?v=371857c65f";
import { initMap, initWhatsApp, initPageTransitions } from "./modules/misc.js?v=371857c65f";
import { initConsent } from "./modules/consent.js?v=371857c65f";
import { initArticles } from "./modules/articles.js?v=371857c65f";

const root = document.documentElement;
if (!root.classList.contains("anim-failed")) root.classList.add("anim-ready");

const modules = [initConsent, initArticles, initSmoothScroll, initHeader, initReveal, initButtons, initCards, initMarquee, initScrollEffects, initGallery, initFaq, initForm, initMap, initWhatsApp, initPageTransitions];

for (const init of modules) {
    try {
        init();
    } catch (error) {
        console.warn(`[site] falha ao iniciar ${init.name}`, error);
    }
}
