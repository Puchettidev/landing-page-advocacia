// Formulário em etapas: área → descrição → contato + LGPD.
// Ao final monta a mensagem e abre o WhatsApp (nenhum dado é enviado a servidor).
import { $, $$, track } from "./env.js?v=115b962aea";

const WHATSAPP_URL = "https://wa.me/5532988480180";

export function initForm() {
    const form = $("[data-form]");
    if (!form) return;

    const steps = $$("[data-step]", form);
    const labels = $$(".mstep__labels li", form);
    const bar = $("[data-form-progress]", form);
    const stepInfo = $("[data-form-stepinfo]", form);
    const btnNext = $("[data-form-next]", form);
    const btnBack = $("[data-form-back]", form);
    const btnSubmit = $("[data-form-submit]", form);
    const status = $("[data-form-status]", form);
    const textarea = $("#descricao", form);
    const counter = $("[data-counter]", form);
    const phone = $("#telefone", form);
    let current = 0;

    const setError = (name, message) => {
        const holder = $(`[data-error-for="${name}"]`, form);
        const field = form.elements[name];
        if (holder) holder.textContent = message || "";
        const inputs = field instanceof RadioNodeList ? [] : field ? [field] : [];
        inputs.forEach((el) => {
            el.setAttribute("aria-invalid", message ? "true" : "false");
            el.classList.toggle("is-valid", !message && el.value.trim() !== "");
            if (message) el.setAttribute("aria-errormessage", holder?.id || "");
        });
        return !message;
    };

    const validators = {
        area: () => setError("area", form.elements.area.value ? "" : "Selecione a área relacionada ao seu caso."),
        descricao: () => {
            const v = textarea.value.trim();
            return setError("descricao", v.length >= 10 ? "" : "Descreva a situação em pelo menos 10 caracteres.");
        },
        nome: () => setError("nome", form.elements.nome.value.trim().length >= 2 ? "" : "Informe seu nome."),
        telefone: () => {
            const digits = phone.value.replace(/\D/g, "");
            return setError("telefone", digits.length >= 10 && digits.length <= 11 ? "" : "Informe um telefone com DDD.");
        },
        email: () => {
            const v = form.elements.email.value.trim();
            return setError("email", !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Confira o e-mail ou deixe em branco.");
        },
        privacidade: () => setError("privacidade", form.elements.privacidade.checked ? "" : "É necessário aceitar a Política de Privacidade."),
    };

    const stepFields = [["area"], ["descricao"], ["nome", "telefone", "email", "privacidade"]];

    const validateStep = (i) => {
        const results = stepFields[i].map((name) => validators[name]());
        const firstInvalid = stepFields[i].find((name, k) => !results[k]);
        if (firstInvalid) {
            const el = form.elements[firstInvalid];
            (el instanceof RadioNodeList ? el[0] : el)?.focus();
            return false;
        }
        return true;
    };

    const goTo = (i) => {
        current = i;
        steps.forEach((s, k) => s.classList.toggle("is-active", k === i));
        labels.forEach((l, k) => {
            l.classList.toggle("is-current", k === i);
            l.classList.toggle("is-done", k < i);
        });
        bar?.style.setProperty("--form-progress", ((i + 1) / steps.length).toFixed(3));
        if (stepInfo) stepInfo.textContent = `Etapa ${i + 1} de ${steps.length}`;
        btnBack.hidden = i === 0;
        btnNext.hidden = i === steps.length - 1;
        btnSubmit.hidden = i !== steps.length - 1;
        status.textContent = "";
        status.classList.remove("is-error");
    };

    const focusStep = () => {
        const first = $("input:not([type=hidden]), textarea", steps[current]);
        first?.focus({ preventScroll: false });
    };

    btnNext.addEventListener("click", () => {
        if (!validateStep(current)) return;
        goTo(current + 1);
        focusStep();
        track("form_step", { step: current + 1 });
    });

    btnBack.addEventListener("click", () => {
        goTo(current - 1);
        focusStep();
    });

    // Avança automaticamente ao escolher a área
    $$('input[name="area"]', form).forEach((radio) => {
        radio.addEventListener("change", () => {
            validators.area();
            if (current === 0) setTimeout(() => {
                goTo(1);
                focusStep();
            }, 260);
        });
    });

    // Enter em campos de texto avança em vez de enviar
    form.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.target.tagName === "INPUT" && current < steps.length - 1) {
            e.preventDefault();
            btnNext.click();
        }
    });

    // Validação em tempo real (após a primeira interação)
    ["nome", "telefone", "email"].forEach((name) => {
        const el = form.elements[name];
        el.addEventListener("blur", () => el.value && validators[name]());
        el.addEventListener("input", () => el.getAttribute("aria-invalid") === "true" && validators[name]());
    });
    form.elements.privacidade.addEventListener("change", validators.privacidade);
    textarea.addEventListener("input", () => {
        counter.textContent = `${textarea.value.length}/${textarea.maxLength}`;
        if (textarea.getAttribute("aria-invalid") === "true") validators.descricao();
    });

    // Máscara simples de telefone brasileiro
    phone.addEventListener("input", () => {
        const d = phone.value.replace(/\D/g, "").slice(0, 11);
        let out = d;
        if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
        if (d.length > 6) out = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
        phone.value = out;
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (form.elements.empresa.value) {
            status.textContent = "Não foi possível processar o envio.";
            status.classList.add("is-error");
            return;
        }
        for (let i = 0; i < steps.length; i++) {
            if (!validateStep(i)) {
                goTo(i);
                validateStep(i);
                status.textContent = "Revise os campos destacados.";
                status.classList.add("is-error");
                return;
            }
        }

        const data = new FormData(form);
        const message = `Olá! Encontrei o escritório pelo site e gostaria de mais informações.

Nome: ${String(data.get("nome")).trim()}
Telefone: ${String(data.get("telefone")).trim()}
E-mail: ${String(data.get("email") || "").trim() || "Não informado"}
Área relacionada: ${data.get("area")}
Descrição inicial: ${String(data.get("descricao")).trim()}

Estou ciente de que o envio desta mensagem não implica contratação automática e que a análise depende dos fatos e documentos do caso.`;

        status.classList.remove("is-error");
        status.textContent = "Abrindo o WhatsApp com a sua mensagem…";
        track("contact_form_whatsapp_submit", { area: data.get("area") });
        window.open(`${WHATSAPP_URL}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    });

    goTo(0);
}
