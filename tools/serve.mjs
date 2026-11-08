// Servidor estático mínimo para testar o site localmente: node tools/serve.mjs [porta]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || process.env.PORT || 5173);
const types = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".avif": "image/avif", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8",
};

createServer(async (req, res) => {
    try {
        let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
        if (p.endsWith("/")) p += "index.html";
        const file = path.join(root, p);
        if (!file.startsWith(root)) throw new Error("fora da raiz");
        await stat(file);
        res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
        res.end(await readFile(file));
    } catch {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404");
    }
}).listen(port, () => console.log(`http://localhost:${port}`));
