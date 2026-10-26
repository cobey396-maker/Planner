/**
 * APP ICONS FOR THE HOME SCREEN
 *
 * Turns app/icon.svg into the PNGs that phones need when you install the app:
 *   public/icons/icon-192.png        Android home screen
 *   public/icons/icon-512.png        Android splash screen, install dialog
 *   public/icons/icon-maskable.png   Android adaptive icon (any shape crop)
 *   app/apple-icon.png               iPhone "Add to Home Screen" (180x180)
 *
 * Run it again whenever the logo changes:  node scripts/make-icons.mjs
 */
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const svg = await readFile(new URL("../app/icon.svg", import.meta.url));
await mkdir(new URL("../public/icons/", import.meta.url), { recursive: true });

// The SVG has rounded corners. Phones round icons themselves, so most sizes
// get a full-bleed square: draw the art on the tint color, no transparency.
const TINT = "#007aff";

async function square(size, file, artScale = 1) {
  const art = Math.round(size * artScale);
  const image = await sharp(svg, { density: 512 }).resize(art, art).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: TINT } })
    .composite([{ input: image, gravity: "center" }])
    .png()
    .toFile(fileURLToPath(new URL(file, import.meta.url)));
  console.log("wrote", file);
}

await square(192, "../public/icons/icon-192.png");
await square(512, "../public/icons/icon-512.png");
// Maskable icons are cropped to a circle or squircle: keep the art inside
// the central 80% "safe zone".
await square(512, "../public/icons/icon-maskable.png", 0.8);
await square(180, "../app/apple-icon.png");
