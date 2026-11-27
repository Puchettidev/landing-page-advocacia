// Publicação agendada: executada diariamente pelo Cron da Vercel (vercel.json → crons).
// Se houver artigo com data de publicação já alcançada, dispara um novo build (Deploy Hook).
// Variáveis: CRON_SECRET (a Vercel envia "Authorization: Bearer <CRON_SECRET>") e VERCEL_DEPLOY_HOOK_URL.
const { SITE_ORIGIN, safeEqual } = require("./_oauth");

module.exports = async (req, res) => {
    const json = (status, body) => {
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Robots-Tag", "noindex, nofollow");
        res.end(JSON.stringify(body));
    };
    const secret = process.env.CRON_SECRET;
    if (!secret || !safeEqual(req.headers.authorization || "", `Bearer ${secret}`)) return json(401, { ok: false });
    const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
    if (!hook || !/^https:\/\/api\.vercel\.com\//.test(hook)) return json(500, { ok: false, error: "VERCEL_DEPLOY_HOOK_URL não configurada" });

    try {
        const agenda = await fetch(`${SITE_ORIGIN}/artigos/agenda.json`, { headers: { "Cache-Control": "no-cache" } }).then((r) => (r.ok ? r.json() : []));
        const due = (Array.isArray(agenda) ? agenda : []).filter((d) => new Date(d) <= new Date());
        if (!due.length) return json(200, { ok: true, rebuild: false, pending: agenda.length || 0 });
        const r = await fetch(hook, { method: "POST" });
        return json(r.ok ? 200 : 502, { ok: r.ok, rebuild: true, due: due.length });
    } catch {
        return json(502, { ok: false });
    }
};
