// Detourage par fond vert (chroma key). A utiliser sur une planche generee
// avec un FOND VERT UNI (#00ff00). Le vert etant tres eloigne de toutes les
// couleurs du personnage (sombre, rouge, or, violet, bleu), on le retire
// proprement — jambes noires comprises, contrairement au fond sombre d'origine.
//
// - Rend transparent les pixels "verts" (alpha progressif sur les bords).
// - "Anti-frange" (de-spill) : retire la teinte verte residuelle sur le contour.
//
// Entree  : assets/hero-green.png   (ta planche a fond vert)
// Sorties : assets/hero-sheet-transparent.png  +  hero-sheet-check.png (magenta)
//
// Usage : node tools/key-green.js  [entree.png]

const Jimp = require("jimp");
const path = require("path");

const A = path.join(__dirname, "..", "assets");
const SRC = process.argv[2] || path.join(A, "hero-green.png");
const OUT = path.join(A, "hero-sheet-transparent.png");
const CHECK = path.join(A, "hero-sheet-check.png");

// Seuils de "verdeur" = G - max(R,B). Au-dessus de HAUT : fond (transparent).
// En-dessous de BAS : personnage (opaque). Entre les deux : bord (alpha partiel).
const BAS = 40;
const HAUT = 120;

(async () => {
  const img = await Jimp.read(SRC);
  const W = img.bitmap.width, H = img.bitmap.height;
  const d = img.bitmap.data;
  const check = img.clone();
  const dc = check.bitmap.data;

  let retires = 0;
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const verdeur = g - Math.max(r, b);

    let alpha = 255;
    if (verdeur >= HAUT) alpha = 0;
    else if (verdeur > BAS) alpha = Math.round(255 * (HAUT - verdeur) / (HAUT - BAS));

    d[i + 3] = alpha;

    // Anti-frange : si le vert domine encore un peu, on le rabaisse au niveau
    // du canal le plus proche pour eviter un lisere vert sur le contour.
    if (alpha > 0 && g > Math.max(r, b)) {
      d[i + 1] = Math.max(r, b);
    }

    // Image de controle : magenta la ou c'est transparent.
    if (alpha < 128) {
      dc[i] = 255; dc[i + 1] = 0; dc[i + 2] = 255; dc[i + 3] = 255; retires++;
    }
  }

  await img.writeAsync(OUT);
  await check.writeAsync(CHECK);
  console.log(`${Math.round((retires / (W * H)) * 100)}% rendu transparent.`);
  console.log("Ecrit : assets/hero-sheet-transparent.png  +  hero-sheet-check.png");
})().catch((e) => { console.error("Echec :", e.message); process.exit(1); });
