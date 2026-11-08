// Microinterações: botões magnéticos, preenchimento a partir do cursor,
// tilt 3D + brilho nos cards, painel de serviços dos cards e marquee.
import { env, $$ } from "./env.js?v=d507f9b5f9";

export function initButtons() {
    $$(".btn").forEach((btn) => {
        btn.addEventListener("pointerenter", (e) => {
            const r = btn.getBoundingClientRect();
            btn.style.setProperty("--fx", `${e.clientX - r.left}px`);
            btn.style.setProperty("--fy", `${e.clientY - r.top}px`);
        });
    });

    if (!env.finePointer || env.reduceMotion) return;

    $$("[data-magnetic]").forEach((el) => {
        const strength = 0.22;
        el.addEventListener("pointermove", (e) => {
            const r = el.getBoundingClientRect();
            const x = (e.clientX - r.left - r.width / 2) * strength;
            const y = (e.clientY - r.top - r.height / 2) * strength;
            el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        });
        el.addEventListener("pointerleave", () => {
            el.style.transform = "";
        });
    });
}

export function initCards() {
    const cards = $$(".area-card");
    if (!cards.length) return;

    // Painel "Ver situações" (toque e teclado)
    cards.forEach((card) => {
        const toggle = card.querySelector(".area-card__toggle");
        if (!toggle) return;
        toggle.addEventListener("click", (e) => {
            e.stopPropagation();
            const open = !card.classList.contains("is-open");
            cards.forEach((c) => {
                if (c !== card) {
                    c.classList.remove("is-open");
                    c.querySelector(".area-card__toggle")?.setAttribute("aria-expanded", "false");
                }
            });
            card.classList.toggle("is-open", open);
            toggle.setAttribute("aria-expanded", String(open));
            toggle.querySelector("span").textContent = open ? "Fechar" : "Ver situações";
        });
    });

    if (!env.finePointer || env.reduceMotion) return;

    // Tilt 3D e brilho seguindo o cursor
    cards.forEach((card) => {
        if (card.classList.contains("area-card--cta")) return;
        const max = card.classList.contains("area-card--featured") ? 4 : 7;
        card.addEventListener("pointermove", (e) => {
            const r = card.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width;
            const py = (e.clientY - r.top) / r.height;
            card.classList.add("is-tilting");
            card.style.setProperty("--ry", `${((px - 0.5) * max).toFixed(2)}deg`);
            card.style.setProperty("--rx", `${((0.5 - py) * max).toFixed(2)}deg`);
            card.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
            card.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
        });
        card.addEventListener("pointerleave", () => {
            card.classList.remove("is-tilting");
            card.style.setProperty("--rx", "0deg");
            card.style.setProperty("--ry", "0deg");
        });
    });
}

export function initMarquee() {
    const track = document.querySelector("[data-marquee]");
    if (!track || env.reduceMotion || !track.getAnimations) return;
    const setRate = (rate) => track.getAnimations().forEach((a) => {
        if (a.updatePlaybackRate) a.updatePlaybackRate(rate);
        else a.playbackRate = rate;
    });
    track.addEventListener("pointerenter", () => setRate(0.2));
    track.addEventListener("pointerleave", () => setRate(1));
}
