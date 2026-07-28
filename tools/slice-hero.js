// Decoupe hero-sheet.png en 10 images centrees sur chaque personnage.
//
// La planche N'EST PAS une grille reguliere : les personnages sont a des x
// irreguliers (mesures via tools/analyse-sheet.js, a partir des labels). On
// centre donc chaque decoupe sur le centre reel du personnage, au lieu de
// diviser betement l'image en cinq.
//
// Usage : node tools/slice-hero.js   (jimp requis)

const Jimp = require("jimp");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "assets", "hero-sheet.png");
const DEST = path.join(__dirname, "..", "assets", "hero");

// Centres x reels de chaque personnage (mesures sur les labels), par rangee.
const CENTRES = [
  [131, 390, 652, 933, 1282], // rangee 1 : persos 1-5
  [129, 402, 663, 935, 1285], // rangee 2 : persos 6-10
];
// Largeur de decoupe par colonne. La 5e (aura/ailes larges) est plus large.
const LARGEUR = [300, 300, 300, 320, 360];
// Marge haute a retirer (numero + "Lv.X") et bas de case.
const MARGE_HAUT = 128;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

(async () => {
  fs.mkdirSync(DEST, { recursive: true });
  const img = await Jimp.read(SRC);
  const W = img.bitmap.width, H = img.bitmap.height;
  const rowH = Math.floor(H / 2);

  let n = 0;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 5; c++) {
      n++;
      const w = LARGEUR[c];
      const left = clamp(Math.round(CENTRES[r][c] - w / 2), 0, W - w);
      const top = r * rowH + MARGE_HAUT;
      const h = (r + 1) * rowH - top;

      const nom = String(n).padStart(2, "0") + ".png";
      await img.clone().crop(left, top, w, h).writeAsync(path.join(DEST, nom));
      console.log(`  ${nom}  centre=${CENTRES[r][c]}  crop x=${left}..${left + w} (${w}x${h})`);
    }
  }
  console.log(`\n${n} images ecrites dans assets/hero/`);
})().catch((e) => { console.error("Echec :", e.message); process.exit(1); });
