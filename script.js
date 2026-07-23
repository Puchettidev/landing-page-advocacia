const WHATSAPP_URL = "https://wa.me/5532988480180";
const DEFAULT_WHATSAPP_TEXT = "Olá! Encontrei o escritório pelo site e gostaria de mais informações.";

const header = document.querySelector(".site-header");
const menuButton = document.querySelector(".menu-toggle");
const navLinks = document.querySelectorAll(".nav-links a");
const revealItems = document.querySelectorAll(".reveal");
const observedSections = document.querySelectorAll("main section[id]");
const contactForm = document.querySelector("#contactForm");

let lastScrollY = window.scrollY;

function trackEvent(eventName, params = {}) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...params });
}

function whatsappLink(message = DEFAULT_WHATSAPP_TEXT) {
    return `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
}

function updateHeader() {
    if (!header) return;

    const currentScroll = window.scrollY;
    header.classList.toggle("scrolled", currentScroll > 16);
    header.classList.toggle("hidden", currentScroll > lastScrollY && currentScroll > 520);
    lastScrollY = currentScroll;
}

function closeMenu() {
    document.body.classList.remove("menu-open");
    menuButton?.setAttribute("aria-expanded", "false");
}

menuButton?.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("menu-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
});

navLinks.forEach((link) => {
    link.addEventListener("click", closeMenu);
});

if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    revealObserver.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.12,
            rootMargin: "0px 0px -60px 0px",
        }
    );

    revealItems.forEach((item, index) => {
        item.style.transitionDelay = `${Math.min(index * 35, 180)}ms`;
        revealObserver.observe(item);
    });

    const sectionObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                const link = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);

                if (entry.isIntersecting && link) {
                    navLinks.forEach((item) => item.classList.remove("active"));
                    link.classList.add("active");
                }
            });
        },
        { threshold: 0.34 }
    );

    observedSections.forEach((section) => sectionObserver.observe(section));
} else {
    revealItems.forEach((item) => item.classList.add("visible"));
}

document.querySelectorAll(".js-track-whatsapp").forEach((link) => {
    link.addEventListener("click", () => {
        trackEvent("whatsapp_click", {
            link_text: link.textContent.trim(),
            page_path: window.location.pathname,
        });
    });
});

document.querySelectorAll(".js-track-phone").forEach((link) => {
    link.addEventListener("click", () => {
        trackEvent("phone_click", { page_path: window.location.pathname });
    });
});

if (contactForm) {
    const status = contactForm.querySelector(".form-status");

    contactForm.addEventListener("submit", (event) => {
        event.preventDefault();

        status.textContent = "";
        status.classList.remove("error");

        const formData = new FormData(contactForm);

        if (formData.get("empresa")) {
            status.textContent = "Não foi possível processar o envio.";
            status.classList.add("error");
            return;
        }

        const nome = String(formData.get("nome") || "").trim();
        const telefone = String(formData.get("telefone") || "").trim();
        const email = String(formData.get("email") || "").trim();
        const area = String(formData.get("area") || "").trim();
        const descricao = String(formData.get("descricao") || "").trim();
        const privacidade = formData.get("privacidade");

        if (!nome || !telefone || !area || !descricao || !privacidade) {
            status.textContent = "Preencha os campos obrigatórios e aceite a Política de Privacidade.";
            status.classList.add("error");
            return;
        }

        const message = `Olá! Encontrei o escritório pelo site e gostaria de mais informações.

Nome: ${nome}
Telefone: ${telefone}
E-mail: ${email || "Não informado"}
Área relacionada: ${area}
Descrição inicial: ${descricao}

Estou ciente de que o envio desta mensagem não implica contratação automática e que a análise depende dos fatos e documentos do caso.`;

        status.textContent = "Abrindo WhatsApp para envio das informações.";
        trackEvent("contact_form_whatsapp_submit", { area, page_path: window.location.pathname });
        window.open(whatsappLink(message), "_blank", "noopener");
    });
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeMenu();
    }
});

window.addEventListener("scroll", updateHeader, { passive: true });
window.addEventListener("load", updateHeader);
