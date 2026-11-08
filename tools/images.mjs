// Gera versões responsivas (AVIF, WebP, JPG) das fotos reais em /imagem
// e versões transparentes do logotipo. Saída em /assets/img + manifest.json.
// Uso: cd tools && npm install && npm run images
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => path.join(root, "imagem", f);
const outDir = path.join(root, "assets", "img");

const photos = [
    { key: "dr-alexandre", file: "dr-alexandre-puchetti-escritorio.png", widths: [480, 800, 1120] },
    { key: "sala-principal", file: "sala-principal-escritorio.png", widths: [480, 800, 1086] },
    { key: "fachada", file: "fachada-escritorio-alexandre-puchetti.png", widths: [480, 800, 1086] },
    { key: "corredor", file: "corredor-escritorio-alexandre-puchetti.png", widths: [480, 800, 941] },
    { key: "sala-atendimento", file: "sala-atendimento-escritorio.png", widths: [640, 1024, 1448] },
    { key: "campo-rural", file: "alongamento-divida-rural.jpg", widths: [800, 1280, 1600] },
];

await mkdir(outDir, { recursive: true });
const manifest = {};

for (const photo of photos) {
    const input = sharp(src(photo.file));
    const meta = await input.metadata();
    const entry = { width: meta.width, height: meta.height, widths: [] };

    for (const w of photo.widths) {
        const width = Math.min(w, meta.width);
        const base = path.join(outDir, `${photo.key}-${width}`);
        const pipeline = sharp(src(photo.file)).resize({ width, withoutEnlargement: true });
        await pipeline.clone().avif({ quality: 52, effort: 6 }).toFile(`${base}.avif`);
        await pipeline.clone().webp({ quality: 74 }).toFile(`${base}.webp`);
        await pipeline.clone().jpeg({ quality: 78, mozjpeg: true, progressive: true }).toFile(`${base}.jpg`);
        entry.widths.push(width);
    }

    manifest[photo.key] = entry;
    console.log("ok", photo.key, entry.widths.join(","));
}

// Recorte em retrato (rosto e tronco) para o bloco "Sobre", diferente do hero
{
    const key = "dr-alexandre-retrato";
    const crop = { left: 360, top: 300, width: 640, height: 800 };
    const entry = { width: crop.width, height: crop.height, widths: [] };
    for (const width of [480, 640]) {
        const base = path.join(outDir, `${key}-${width}`);
        const pipeline = sharp(src("dr-alexandre-puchetti-escritorio.png")).extract(crop).resize({ width });
        await pipeline.clone().avif({ quality: 52, effort: 6 }).toFile(`${base}.avif`);
        await pipeline.clone().webp({ quality: 76 }).toFile(`${base}.webp`);
        await pipeline.clone().jpeg({ quality: 80, mozjpeg: true, progressive: true }).toFile(`${base}.jpg`);
        entry.widths.push(width);
    }
    manifest[key] = entry;
    console.log("ok", key);
}

// Imagem para Open Graph (1200x630, recorte central)
await sharp(src("dr-alexandre-puchetti-escritorio.png"))
    .resize({ width: 1200, height: 630, fit: "cover", position: "north" })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(path.join(outDir, "og-alexandre-campos-puchetti.jpg"));

// Logotipo: o original é preto sobre branco. Usa a luminância invertida como canal alfa
// e aplica a cor desejada, gerando um monograma transparente.
async function tintedLogo(hex, name, size) {
    const { data, info } = await sharp(src("logotipo-alexandre-puchetti.png"))
        .trim({ threshold: 40 })
        .resize({ width: size, height: size, fit: "contain", background: "#ffffff" })
        .flatten({ background: "#ffffff" })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const rgba = Buffer.alloc(info.width * info.height * 4);
    for (let i = 0; i < info.width * info.height; i++) {
        const alpha = 255 - data[i];
        rgba[i * 4] = r;
        rgba[i * 4 + 1] = g;
        rgba[i * 4 + 2] = b;
        rgba[i * 4 + 3] = alpha < 12 ? 0 : alpha;
    }

    const img = sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } });
    await img.clone().png({ compressionLevel: 9 }).toFile(path.join(outDir, `${name}.png`));
    await img.clone().webp({ quality: 90, alphaQuality: 90 }).toFile(path.join(outDir, `${name}.webp`));
}

await tintedLogo("#c9a45c", "monograma-trigo", 160);
await tintedLogo("#f5f1e8", "monograma-claro", 160);

await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("manifest gravado");
