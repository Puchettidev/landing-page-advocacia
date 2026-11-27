// Utilitários compartilhados do login do painel (/admin) via GitHub OAuth.
// Arquivos iniciados por "_" não viram rotas na Vercel.
const crypto = require("node:crypto");

const SITE_ORIGIN = (process.env.SITE_URL || "https://www.alexandrecampospuchetti.com.br").replace(/\/+$/, "");
const STATE_COOKIE = "__Host-acp_oauth_state";

function send(res, status, body, headers = {}) {
    res.statusCode = status;
    const base = {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
    };
    for (const [k, v] of Object.entries({ ...base, ...headers })) res.setHeader(k, v);
    res.end(body);
}

function readCookie(req, name) {
    const raw = req.headers.cookie || "";
    for (const part of raw.split(";")) {
        const [k, ...v] = part.trim().split("=");
        if (k === name) return decodeURIComponent(v.join("="));
    }
    return "";
}

function safeEqual(a, b) {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function page(title, text) {
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${esc(title)}</title></head><body style="font-family:system-ui,sans-serif;padding:32px;max-width:560px"><h1 style="font-size:1.3rem">${esc(title)}</h1><p>${esc(text)}</p></body></html>`;
}

module.exports = { crypto, SITE_ORIGIN, STATE_COOKIE, send, readCookie, safeEqual, esc, page };
