const header = document.querySelector(".site-header");
const menuButton = document.querySelector(".menu-toggle");
const navLinks = document.querySelectorAll(".nav-links a");
const revealItems = document.querySelectorAll(".reveal");
const observedSections = document.querySelectorAll("main section[id]");
const quiz = document.querySelector("[data-quiz]");

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

if (quiz) {
    const startScreen = quiz.querySelector("[data-quiz-start]");
    const beginButton = quiz.querySelector("[data-quiz-begin]");
    const flow = quiz.querySelector("[data-quiz-flow]");
    const steps = [...quiz.querySelectorAll("[data-quiz-step]")];
    const finalScreen = quiz.querySelector("[data-quiz-final]");
    const progress = quiz.querySelector("[data-quiz-progress]");
    const counter = quiz.querySelector("[data-quiz-counter]");
    const selectedLabel = quiz.querySelector("[data-quiz-selected]");
    const summary = quiz.querySelector("[data-quiz-summary]");
    const whatsappButton = quiz.querySelector("[data-quiz-whatsapp]");
    const questions = [
        "Situação principal",
        "Fator que afetou o pagamento",
        "Relação atual com o banco",
        "Documentos disponíveis",
    ];
    const answers = [];

    function setProgress(stepIndex) {
        const progressValue = Math.round((stepIndex / steps.length) * 100);
        progress.style.width = `${progressValue}%`;
    }

    function showStep(stepIndex) {
        steps.forEach((step, index) => {
            const isCurrent = index === stepIndex;
            step.hidden = !isCurrent;
            step.classList.toggle("is-active", isCurrent);
        });

        counter.textContent = `Etapa ${stepIndex + 1} de ${steps.length}`;
        selectedLabel.textContent = "Selecione uma opção";
        setProgress(stepIndex);
    }

    function buildWhatsappUrl() {
        const message = `Olá, gostaria de uma análise sobre possibilidade de alongamento da minha dívida rural.

Preenchi o diagnóstico jurídico no site:

Situação principal: ${answers[0]}
Fator que afetou o pagamento: ${answers[1]}
Relação atual com o banco: ${answers[2]}
Documentos disponíveis: ${answers[3]}

Gostaria de uma análise do meu caso rural.`;

        return `https://wa.me/5532988480180?text=${encodeURIComponent(message)}`;
    }

    function finishQuiz() {
        steps.forEach((step) => {
            step.hidden = true;
            step.classList.remove("is-active");
        });

        counter.textContent = "Concluído";
        selectedLabel.textContent = "Pronto para envio";
        progress.style.width = "100%";
        finalScreen.hidden = false;
        finalScreen.style.animation = "quizFade 260ms ease both";

        summary.innerHTML = questions
            .map((question, index) => `<div class="quiz-summary-row"><strong>${question}</strong><span>${answers[index]}</span></div>`)
            .join("");

        whatsappButton.href = buildWhatsappUrl();
    }

    beginButton.addEventListener("click", () => {
        startScreen.hidden = true;
        flow.hidden = false;
        finalScreen.hidden = true;
        showStep(0);
    });

    steps.forEach((step, stepIndex) => {
        step.querySelectorAll("[data-answer]").forEach((button) => {
            button.addEventListener("click", () => {
                answers[stepIndex] = button.dataset.answer;
                selectedLabel.textContent = button.dataset.answer;
                step.querySelectorAll("[data-answer]").forEach((option) => option.classList.remove("is-selected"));
                button.classList.add("is-selected");

                window.setTimeout(() => {
                    if (stepIndex === steps.length - 1) {
                        finishQuiz();
                        return;
                    }

                    showStep(stepIndex + 1);
                }, 180);
            });
        });
    });
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeMenu();
    }
});

window.addEventListener("scroll", updateHeader, { passive: true });
window.addEventListener("load", updateHeader);
