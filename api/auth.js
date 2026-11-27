// Início do login do painel: redireciona para a autorização do GitHub.
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET  — OAuth App do GitHub
//   SITE_URL (opcional)                     — padrão: https://www.alexandrecampospuchetti.com.br
//   GITHUB_SCOPE (opcional)                 — padrão: "repo" (use "public_repo" se o repositório for público)
const { crypto, SITE_ORIGIN, STATE_COOKIE, send, page } = require("./_oauth");

module.exports = (req, res) => {
    if (req.method !== "GET") return send(res, 405, page("Método não permitido", "Use o botão de login do painel."), { Allow: "GET" });
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId || !process.env.GITHUB_CLIENT_SECRET) {
        return send(res, 500, page("Login não configurado", "Defina GITHUB_CLIENT_ID e GITHUB_CLIENT_SECRET nas variáveis de ambiente da Vercel."));
    }
    const scope = /^(repo|public_repo)$/.test(process.env.GITHUB_SCOPE || "") ? process.env.GITHUB_SCOPE : "repo";
    // "state" aleatório guardado em cookie HttpOnly: protege o retorno contra CSRF.
    const state = crypto.randomBytes(32).toString("hex");
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", `${SITE_ORIGIN}/api/callback`);
    url.searchParams.set("scope", scope);
    url.searchParams.set("state", state);
    url.searchParams.set("allow_signup", "false");
    res.statusCode = 302;
    res.setHeader("Set-Cookie", `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Location", url.toString());
    res.end();
};
