// Revela elementos ao entrar na tela (adiciona .is-in). As animações em si estão no CSS.
import { $$ } from "./env.js?v=d507f9b5f9";

export function initReveal() {
    const items = $$("[data-reveal], [data-split]:not([data-split='hero'])");
    if (!("IntersectionObserver" in window)) {
        items.forEach((el) => el.classList.add("is-in"));
        return;
    }

    // Atraso escalonado entre irmãos que entram juntos
    const groups = new Map();
    $$("[data-reveal]").forEach((el) => {
        const parent = el.parentElement;
        const index = groups.get(parent) || 0;
        groups.set(parent, index + 1);
        el.style.setProperty("--d", `${Math.min(index * 70, 420)}ms`);
    });

    // Elementos com clip-path total não "intersectam"; nesses casos observa o pai.
    const targets = new Map();
    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                (targets.get(entry.target) || [entry.target]).forEach((el) => el.classList.add("is-in"));
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

    items.forEach((el) => {
        const observed = el.dataset.reveal === "clip" ? el.parentElement : el;
        targets.set(observed, [...(targets.get(observed) || []), el]);
        io.observe(observed);
    });
}
