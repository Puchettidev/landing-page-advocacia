// Efeitos ligados à rolagem (GSAP + ScrollTrigger): parallax, galeria fixada
// com rolagem horizontal e linha do tempo que se preenche.
import { env, $, $$ } from "./env.js?v=d507f9b5f9";

export function initScrollEffects() {
    const gsap = env.gsap;
    initTimelines(gsap);
    if (!gsap || env.reduceMotion) return;

    gsap.registerPlugin(window.ScrollTrigger);
    const mm = gsap.matchMedia();

    // Parallax da foto do hero
    const heroPhoto = $(".hero__photo picture");
    if (heroPhoto) {
        gsap.to(heroPhoto, {
            yPercent: 10,
            ease: "none",
            scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
        });
    }

    // Parallax do fundo da faixa rural
    const ruralMedia = $(".rural-band__media");
    if (ruralMedia) {
        gsap.fromTo(ruralMedia, { yPercent: -8 }, {
            yPercent: 8,
            ease: "none",
            scrollTrigger: { trigger: ".rural-band", start: "top bottom", end: "bottom top", scrub: true },
        });
    }

    // Galeria: rolagem horizontal fixada no desktop
    mm.add("(min-width: 1024px)", () => {
        const triggers = [];
        $$("[data-gallery]").forEach((gallery) => {
            const track = $("[data-gallery-track]", gallery);
            const section = gallery.closest("section");
            const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
            if (distance() < 40) return;
            gallery.classList.add("is-pinned");
            const tween = gsap.to(track, {
                x: () => -distance(),
                ease: "none",
                scrollTrigger: {
                    trigger: section,
                    start: "top top",
                    end: () => `+=${distance()}`,
                    pin: true,
                    scrub: 0.6,
                    invalidateOnRefresh: true,
                    anticipatePin: 1,
                },
            });
            triggers.push(() => {
                gallery.classList.remove("is-pinned");
                tween.scrollTrigger?.kill();
                tween.kill();
                gsap.set(track, { clearProps: "transform" });
            });
        });
        return () => triggers.forEach((fn) => fn());
    });

    // Recalcula após carregar fontes e imagens (alturas mudam)
    const refresh = () => window.ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    if (document.readyState === "complete") refresh();
    else window.addEventListener("load", refresh, { once: true });
}

function initTimelines(gsap) {
    $$("[data-timeline]").forEach((tl) => {
        const steps = $$(".timeline__step", tl);
        const setProgress = (p) => {
            tl.style.setProperty("--p", p.toFixed(3));
            steps.forEach((step, i) => step.classList.toggle("is-active", p >= (i + 0.35) / steps.length || p > 0.98));
        };

        if (env.reduceMotion) {
            steps.forEach((s) => s.classList.add("is-active"));
            return;
        }

        if (gsap) {
            gsap.registerPlugin(window.ScrollTrigger);
            window.ScrollTrigger.create({
                trigger: tl,
                start: "top 75%",
                end: "bottom 55%",
                scrub: true,
                onUpdate: (self) => setProgress(self.progress),
            });
        } else {
            // Sem GSAP: ativa todas as etapas ao entrar na tela
            const io = new IntersectionObserver(([entry]) => {
                if (entry.isIntersecting) {
                    setProgress(1);
                    io.disconnect();
                }
            }, { threshold: 0.3 });
            io.observe(tl);
        }
    });
}
