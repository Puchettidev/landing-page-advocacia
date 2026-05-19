const header = document.querySelector(".site-header");
const menuButton = document.querySelector(".menu-toggle");
const navLinks = document.querySelectorAll(".nav-links a");
const revealItems = document.querySelectorAll(".reveal");
const observedSections = document.querySelectorAll("main section[id]");

let lastScrollY = window.scrollY;

function updateHeader() {
    const currentScroll = window.scrollY;

    header.classList.toggle("scrolled", currentScroll > 16);
    header.classList.toggle("hidden", currentScroll > lastScrollY && currentScroll > 520);

    lastScrollY = currentScroll;
}

function closeMenu() {
    document.body.classList.remove("menu-open");
    menuButton.setAttribute("aria-expanded", "false");
}

menuButton.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("menu-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
});

navLinks.forEach((link) => {
    link.addEventListener("click", closeMenu);
});

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
        threshold: 0.16,
        rootMargin: "0px 0px -70px 0px",
    }
);

revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 55, 220)}ms`;
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
    {
        threshold: 0.42,
    }
);

observedSections.forEach((section) => sectionObserver.observe(section));

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeMenu();
    }
});

window.addEventListener("scroll", updateHeader, { passive: true });
window.addEventListener("load", updateHeader);
