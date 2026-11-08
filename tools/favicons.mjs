// Gera os ícones do navegador (favicon) a partir do monograma do logotipo:
// fundo verde-escuro com cantos arredondados e o "A" em dourado.
// Uso: cd tools && npm run favicons
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INK = "#07130f";
const WHEAT = [201, 164, 92];

// Monograma dourado com fundo transparente (luminância invertida vira alfa)
async function monogram(size) {
    const { data, info } = await sharp(path.join(root, "imagem/logotipo-alexandre-puchetti.png"))
        .trim({ threshold: 40 })
        .resize({ width: size, height: size, fit: "contain", background: "#ffffff" })
        .flatten({ background: "#ffffff" })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const rgba = Buffer.alloc(info.width * info.height * 4);
    for (let i = 0; i < info.width * info.height; i++) {
        const a = 255 - data[i];
        rgba.set([...WHEAT, a < 10 ? 0 : a], i * 4);
    }
    return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// Ícone quadrado: fundo arredondado + monograma ocupando ~66% (um pouco mais nos tamanhos pequenos)
async function icon(size, { rounded = true } = {}) {
    const ratio = size <= 32 ? 0.74 : 0.64;
    const inner = Math.round(size * ratio);
    const radius = rounded ? Math.round(size * 0.22) : 0;
    const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${INK}"/><rect x="${size * 0.04}" y="${size * 0.04}" width="${size * 0.92}" height="${size * 0.92}" rx="${radius * 0.85}" fill="none" stroke="rgb(${WHEAT})" stroke-opacity="${size <= 32 ? 0 : 0.35}" stroke-width="${Math.max(1, size / 96)}"/></svg>`);
    const mark = await monogram(inner);
    const offset = Math.round((size - inner) / 2);
    return sharp(bg).composite([{ input: mark, left: offset, top: offset }]).png({ compressionLevel: 9 }).toBuffer();
}

// Arquivo .ico com imagens PNG embutidas (16, 32, 48)
function ico(pngs) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(pngs.length, 4);
    const dir = Buffer.alloc(16 * pngs.length);
    let offset = 6 + dir.length;
    pngs.forEach(({ size, buf }, i) => {
        const o = i * 16;
        dir.writeUInt8(size >= 256 ? 0 : size, o);
        dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
        dir.writeUInt8(0, o + 2);
        dir.writeUInt8(0, o + 3);
        dir.writeUInt16LE(1, o + 4);
        dir.writeUInt16LE(32, o + 6);
        dir.writeUInt32LE(buf.length, o + 8);
        dir.writeUInt32LE(offset, o + 12);
        offset += buf.length;
    });
    return Buffer.concat([header, dir, ...pngs.map((p) => p.buf)]);
}

const out = (f) => path.join(root, f);
const small = await Promise.all([16, 32, 48].map(async (size) => ({ size, buf: await icon(size) })));
await writeFile(out("favicon.ico"), ico(small));
await writeFile(out("favicon-32.png"), small[1].buf);
await writeFile(out("favicon-48.png"), small[2].buf);
await writeFile(out("favicon.png"), await icon(192));
await writeFile(out("favicon-512.png"), await icon(512));
// Apple: sem cantos (o iOS arredonda sozinho)
await writeFile(out("apple-touch-icon.png"), await icon(180, { rounded: false }));
await writeFile(out("site.webmanifest"), JSON.stringify({
    name: "Alexandre Campos Puchetti Advocacia",
    short_name: "ACP Advocacia",
    icons: [
        { src: "/favicon.png", sizes: "192x192", type: "image/png" },
        { src: "/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
    theme_color: "#07130f",
    background_color: "#07130f",
    display: "browser",
}, null, 2));
console.log("favicons gerados");
