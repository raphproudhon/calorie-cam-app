// Retire le fond sombre de hero-sheet.png et le rend TRANSPARENT.
//
// Le fond n'est pas un noir uni : c'est un degrade sombre (avec vignette et
// aura violette) et le personnage est lui-meme tres sombre. Un seuil global
// trouerait le personnage. On procede donc par "remplissage par region depuis
// les bords" : on part des bords de l'image (forcement du fond) et on avance de
// proche en proche tant que la couleur varie PEU (le degrade du fond varie
// doucement). On s'arrete des qu'il y a un saut de couleur (contour du
// personnage, ou aura violette saturee) — ce qui preserve le perso et l'aura.
//
// Sorties :
//   assets/hero-sheet-transparent.png   (le resultat, fond transparent)
//   assets/hero-sheet-check.png          (compose sur MAGENTA pour verifier)
//
// Usage : node tools/remove-bg.js  [tolerance] [plancher]   (defaut 12, 24)
//
// Le PLANCHER de luminosite protege le personnage : le fond est sombre mais pas
// noir (luminosite ~25-45), tandis que les vetements/jambes du perso sont quasi
// noirs (~10-20). Un pixel ne peut devenir "fond" que si sa luminosite depasse
// le plancher — donc les jambes noires ne sont jamais effacees.

const Jimp = require("jimp");
const path = require("path");

const SRC = path.join(__dirname, "..", "assets", "hero-sheet.png");
const OUT = path.join(__dirname, "..", "assets", "hero-sheet-transparent.png");
const CHECK = path.join(__dirname, "..", "assets", "hero-sheet-check.png");

const TOL = Number(process.argv[2]) || 12;      // tolerance de variation locale
const PLANCHER = Number(process.argv[3]) || 24; // luminosite minimale pour etre "fond"

(async () => {
  const img = await Jimp.read(SRC);
  const W = img.bitmap.width, H = img.bitmap.height;
  const d = img.bitmap.data; // RGBA
  const idx = (x, y) => (y * W + x) * 4;

  const estFond = new Uint8Array(W * H);   // 1 = fond (a rendre transparent)
  const vu = new Uint8Array(W * H);
  const pile = [];

  function pousserBord() {
    for (let x = 0; x < W; x++) { pile.push([x, 0]); pile.push([x, H - 1]); }
    for (let y = 0; y < H; y++) { pile.push([0, y]); pile.push([W - 1, y]); }
  }
  pousserBord();

  // Distance couleur (somme des ecarts RGB) entre deux pixels.
  function dist(i, j) {
    return Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);
  }

  while (pile.length) {
    const [x, y] = pile.pop();
    const p = y * W + x;
    if (vu[p]) continue;
    vu[p] = 1;
    estFond[p] = 1;
    const ip = idx(x, y);
    // Voisins : rejoignent le fond s'ils sont proches en couleur du pixel courant.
    const vois = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of vois) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const np = ny * W + nx;
      if (vu[np]) continue;
      const jn = idx(nx, ny);
      const lum = (d[jn] + d[jn + 1] + d[jn + 2]) / 3;
      // Rejoint le fond seulement si proche du voisin ET pas trop sombre
      // (les jambes/vetements quasi noirs restent proteges).
      if (lum >= PLANCHER && dist(ip, jn) <= TOL) pile.push([nx, ny]);
    }
  }

  // Applique la transparence + prepare l'image de controle (magenta).
  const check = img.clone();
  const dc = check.bitmap.data;
  let retires = 0;
  for (let p = 0; p < W * H; p++) {
    if (estFond[p]) {
      d[p * 4 + 3] = 0;                    // alpha 0 dans le resultat
      dc[p * 4] = 255; dc[p * 4 + 1] = 0; dc[p * 4 + 2] = 255; dc[p * 4 + 3] = 255; // magenta
      retires++;
    }
  }

  await img.writeAsync(OUT);
  await check.writeAsync(CHECK);
  const pct = Math.round((retires / (W * H)) * 100);
  console.log(`Tolerance ${TOL} : ${pct}% des pixels rendus transparents.`);
  console.log("Ecrit : assets/hero-sheet-transparent.png  et  hero-sheet-check.png");
})().catch((e) => { console.error("Echec :", e.message); process.exit(1); });
