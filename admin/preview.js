/* global CMS, createClass, h */
// Prévia dos artigos no painel e componente de tabela para o editor.
(function () {
    if (!window.CMS) return;

    CMS.registerPreviewStyle("/assets/css/main.css");
    CMS.registerPreviewStyle("/assets/css/artigos.css");
    CMS.registerPreviewStyle(
        "body{background:#fbf9f4;padding:0;margin:0}.pv-hero{background:#07130f;color:#f5f1e8;padding:48px 32px}.pv-hero h1{font-size:2.4rem;max-width:24ch;margin-top:12px}.pv-hero p{color:rgba(245,241,232,.74);margin-top:14px;max-width:62ch}.pv-wrap{padding:36px 32px 64px;max-width:820px;margin:0 auto}.pv-cover{width:100%;max-height:420px;object-fit:cover;border-radius:18px;margin-bottom:32px}.pv-meta{font-size:.9rem;margin-top:18px;color:rgba(245,241,232,.74)}.pv-flag{display:inline-block;padding:6px 12px;border:1px dashed #c9a45c;border-radius:10px;color:#e3c88e;font-size:.8rem;font-weight:700}",
        { raw: true },
    );

    const fmt = (v) => {
        if (!v) return "sem data";
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? "sem data" : d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
    };

    const ArticlePreview = createClass({
        render() {
            const entry = this.props.entry;
            const get = (k) => entry.getIn(["data", k]);
            const cover = get("capa");
            const status = get("status") === "publicado" ? (new Date(get("publicado_em")) > new Date() ? "Agendado" : "Publicado") : "Rascunho";
            const refs = (get("referencias") || []).toJS ? get("referencias").toJS() : [];
            return h(
                "div",
                {},
                h(
                    "div",
                    { className: "pv-hero" },
                    h("span", { className: "pv-flag" }, `Prévia · ${status}`),
                    h("h1", {}, get("titulo") || "Título do artigo"),
                    get("resumo") ? h("p", {}, get("resumo")) : null,
                    h("p", { className: "pv-meta" }, `Por ${get("autor") || "Dr. Alexandre Campos Puchetti"} · Publicado em ${fmt(get("publicado_em"))}${get("atualizado_em") ? ` · Atualizado em ${fmt(get("atualizado_em"))}` : ""}`),
                ),
                h(
                    "div",
                    { className: "pv-wrap" },
                    cover ? h("img", { className: "pv-cover", src: this.props.getAsset(cover).toString(), alt: get("capa_alt") || "" }) : null,
                    h("div", { className: "article-body" }, this.props.widgetFor("corpo")),
                    refs.length
                        ? h("section", { className: "article-refs" }, h("h2", {}, "Referências"), h("ol", {}, refs.map((r, i) => h("li", { key: i }, r.texto))))
                        : null,
                    h("p", { className: "legal-note article-disclaimer" }, "O conteúdo deste site possui caráter exclusivamente informativo e não substitui consulta jurídica individualizada."),
                ),
            );
        },
    });
    CMS.registerPreviewTemplate("artigos", ArticlePreview);

    // ---------- Tabela (Markdown no padrão GFM) ----------
    const splitRow = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    const escCell = (s) => String(s || "").replace(/\|/g, "/").trim();
    const escHtml = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    CMS.registerEditorComponent({
        id: "tabela",
        label: "Tabela",
        fields: [
            { name: "cabecalho", label: "Cabeçalho (separe as colunas com | )", widget: "string", hint: "Ex.: Documento | Finalidade" },
            { name: "linhas", label: "Linhas (uma por linha; colunas separadas por | )", widget: "text", hint: "Ex.: Contrato | Verificar as cláusulas" },
        ],
        pattern: /^\|([^\n]+)\|[ \t]*\n\|(?:[ \t]*:?-+:?[ \t]*\|)+[ \t]*\n((?:\|[^\n]*\|[ \t]*(?:\n|$))*)/,
        fromBlock(match) {
            return {
                cabecalho: splitRow(match[1]).join(" | "),
                linhas: match[2]
                    .split("\n")
                    .filter((l) => l.trim())
                    .map((l) => splitRow(l).join(" | "))
                    .join("\n"),
            };
        },
        toBlock(data) {
            const head = String(data.cabecalho || "Coluna 1 | Coluna 2").split("|").map(escCell);
            const rows = String(data.linhas || "")
                .split("\n")
                .filter((l) => l.trim())
                .map((l) => {
                    const cells = l.split("|").map(escCell);
                    while (cells.length < head.length) cells.push("");
                    return cells.slice(0, head.length);
                });
            const line = (cells) => `| ${cells.join(" | ")} |`;
            return [line(head), line(head.map(() => "---")), ...rows.map(line)].join("\n");
        },
        toPreview(data) {
            const head = String(data.cabecalho || "").split("|").map((c) => `<th>${escHtml(c.trim())}</th>`).join("");
            const rows = String(data.linhas || "")
                .split("\n")
                .filter((l) => l.trim())
                .map((l) => `<tr>${l.split("|").map((c) => `<td>${escHtml(c.trim())}</td>`).join("")}</tr>`)
                .join("");
            return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
        },
    });
})();
