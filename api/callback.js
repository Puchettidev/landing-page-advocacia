// Retorno do GitHub: valida o "state", troca o código pelo token e o entrega
// à janela do painel (/admin) via postMessage restrito à origem do site.
// Opcional: ADMIN_GITHUB_USERS="usuario1,usuario2" limita quem pode entrar.
const { crypto, SITE_ORIGIN, STATE_COOKIE, send, readCookie, safeEqual, page } = require("./_oauth");

const clearCookie = `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

function reply(res, status, payload) {
    const nonce = crypto.randomBytes(16).toString("base64");
    const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
    // JSON seguro dentro de <script>
    const data = JSON.stringify({ origin: SITE_ORIGIN, message }).replace(/</g, "\\u003c");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Login do painel</title></head><body style="font-family:system-ui,sans-serif;padding:32px">
<p>${status === "success" ? "Login concluído. Esta janela será fechada." : "Não foi possível concluir o login. Feche esta janela e tente novamente."}</p>
<script nonce="${nonce}">
(function () {
  var d = ${data};
  if (!window.opener) return;
  function receive(e) {
    if (e.origin !== d.origin) return;
    window.removeEventListener("message", receive);
    window.opener.postMessage(d.message, d.origin);
    setTimeout(function () { window.close(); }, 400);
  }
  window.addEventListener("message", receive, false);
  window.opener.postMessage("authorizing:github", d.origin);
})();
</script></body></html>`;
    send(res, 200, html, {
        "Set-Cookie": clearCookie,
        "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    });
}

module.exports = async (req, res) => {
    if (req.method !== "GET") return send(res, 405, page("Método não permitido", "Use o botão de login do painel."), { Allow: "GET" });
    const url = new URL(req.url, SITE_ORIGIN);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    const expected = readCookie(req, STATE_COOKIE);

    if (url.searchParams.get("error")) return reply(res, "error", { message: "Autorização negada no GitHub." });
    if (!safeEqual(state, expected) || !/^[\w-]{1,100}$/.test(code)) {
        return send(res, 403, page("Sessão de login inválida", "O pedido de login expirou ou não foi iniciado por este site. Volte ao painel e tente novamente."), { "Set-Cookie": clearCookie });
    }

    try {
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "acp-site-admin" },
            body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${SITE_ORIGIN}/api/callback` }),
        });
        const data = await tokenRes.json();
        if (!data.access_token) return reply(res, "error", { message: "O GitHub não confirmou o login." });

        const allowed = String(process.env.ADMIN_GITHUB_USERS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
        if (allowed.length) {
            const userRes = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${data.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "acp-site-admin" } });
            const user = await userRes.json();
            if (!allowed.includes(String(user.login || "").toLowerCase())) {
                return reply(res, "error", { message: "Este usuário do GitHub não tem permissão para acessar o painel." });
            }
        }
        return reply(res, "success", { token: data.access_token, provider: "github" });
    } catch {
        return reply(res, "error", { message: "Falha de comunicação com o GitHub." });
    }
};
