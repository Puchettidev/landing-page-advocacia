// Galeria: arrastar com o mouse (fora do modo fixado) e lightbox acessível.
import { $, $$ } from "./env.js?v=115b962aea";
import { lenis } from "./smooth.js?v=115b962aea";

export function initGallery() {
    $$("[data-gallery]").forEach((gallery) => {
        const viewport = $("[data-gallery-viewport]", gallery);
        preloadWhenNear(gallery);
        enableDrag(gallery, viewport);
        initLightbox(gallery);
    });
}

// Fotos fora da tela na horizontal não são carregadas pelo lazy-load nativo;
// ao se aproximar da galeria, carrega todas para não aparecerem em branco.
function preloadWhenNear(gallery) {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        $$("img[loading='lazy']", gallery).forEach((img) => (img.loading = "eager"));
        io.disconnect();
    }, { rootMargin: "600px 0px" });
    io.observe(gallery);
}

function enableDrag(gallery, viewport) {
    if (!viewport) return;
    let down = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    viewport.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "mouse" || gallery.classList.contains("is-pinned")) return;
        down = true;
        moved = false;
        startX = e.clientX;
        startScroll = viewport.scrollLeft;
    });
    window.addEventListener("pointermove", (e) => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 4) {
            moved = true;
            viewport.classList.add("is-dragging");
        }
        viewport.scrollLeft = startScroll - dx;
    });
    window.addEventListener("pointerup", () => {
        down = false;
        viewport.classList.remove("is-dragging");
    });
    // Evita abrir a foto ao final de um arraste
    viewport.addEventListener("click", (e) => {
        if (moved) {
            e.preventDefault();
            e.stopPropagation();
            moved = false;
        }
    }, true);
}

function initLightbox(gallery) {
    const dataEl = $("[data-gallery-data]", gallery);
    const dialog = gallery.nextElementSibling?.matches("[data-lightbox-dialog]") ? gallery.nextElementSibling : null;
    if (!dataEl || !dialog || typeof dialog.showModal !== "function") return;

    const photos = JSON.parse(dataEl.textContent);
    const img = $("[data-lightbox-img]", dialog);
    const caption = $("[data-lightbox-caption]", dialog);
    let index = 0;
    let opener = null;

    const show = (i) => {
        index = (i + photos.length) % photos.length;
        img.src = photos[index].src;
        img.alt = photos[index].alt;
        caption.textContent = `${photos[index].caption} — ${index + 1} de ${photos.length}`;
    };

    $$("[data-lightbox]", gallery).forEach((btn) => {
        btn.addEventListener("click", () => {
            opener = btn;
            show(Number(btn.dataset.lightbox));
            dialog.showModal();
            lenis?.stop();
        });
    });

    $("[data-lightbox-prev]", dialog).addEventListener("click", () => show(index - 1));
    $("[data-lightbox-next]", dialog).addEventListener("click", () => show(index + 1));
    $("[data-lightbox-close]", dialog).addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => {
        if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") show(index - 1);
        if (e.key === "ArrowRight") show(index + 1);
    });
    dialog.addEventListener("close", () => {
        lenis?.start();
        opener?.focus({ preventScroll: true });
    });
}
