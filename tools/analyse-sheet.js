// Analyse hero-sheet.png : trouve la position REELLE de chaque personnage
// (l'espacement de la planche n'est pas parfaitement regulier). Pour chaque
// rangee, on calcule un "profil de contenu" par colonne (pixels non-fond) et on
// en deduit les segments = colonnes occupees par un personnage/aura.

const Jimp = require("jimp");
const path = require("path");

const SRC = path.join(__dirname, "..", "assets", "hero-sheet.png");

(async () => {
  const img = await Jimp.read(SRC);
  const W = img.bitmap.width, H = img.bitmap.height;
  const rowH = Math.floor(H / 2);

  // Seuil : le fond est tres sombre. On compte comme "contenu" un pixel dont la
  // luminance depasse ce seuil (attrape aura, peau, or, rouge, reflets).
  const SEUIL = 60;

  function profil(y0, y1) {
    const counts = new Array(W).fill(0);
    for (let x = 0; x < W; x++) {
      let c = 0;
      for (let y = y0; y < y1; y += 2) {
        const { r, g, b } = Jimp.intToRGBA(img.getPixelColor(x, y));
        if ((r + g + b) / 3 > SEUIL) c++;
      }
      counts[x] = c;
    }
    return counts;
  }

  // Segments : suites de colonnes ou le contenu depasse un plancher.
  function segments(counts, plancher) {
    const segs = [];
    let start = -1;
    for (let x = 0; x < counts.length; x++) {
      if (counts[x] > plancher) {
        if (start < 0) start = x;
      } else if (start >= 0) {
        segs.push([start, x - 1]);
        start = -1;
      }
    }
    if (start >= 0) segs.push([start, counts.length - 1]);
    // Fusionne les segments proches (< 25 px de trou) et ignore les minuscules.
    const fusion = [];
    for (const s of segs) {
      const prev = fusion[fusion.length - 1];
      if (prev && s[0] - prev[1] < 25) prev[1] = s[1];
      else fusion.push([...s]);
    }
    return fusion.filter((s) => s[1] - s[0] > 20);
  }

  // Profil sur du texte clair (labels numero + Lv.X), tres contraste.
  function profilTexte(y0, y1) {
    const counts = new Array(W).fill(0);
    for (let x = 0; x < W; x++) {
      let c = 0;
      for (let y = y0; y < y1; y++) {
        const { r, g, b } = Jimp.intToRGBA(img.getPixelColor(x, y));
        if ((r + g + b) / 3 > 150) c++; // texte clair uniquement
      }
      counts[x] = c;
    }
    return counts;
  }

  for (let r = 0; r < 2; r++) {
    // Bande des labels (numero + "Lv.X"), en haut de la rangee.
    const counts = profilTexte(r * rowH + 6, r * rowH + 108);
    const segs = segments(counts, 1);
    console.log(`\n=== Rangee ${r + 1} : ${segs.length} labels detectes ===`);
    segs.forEach((s, i) => {
      const centre = Math.round((s[0] + s[1]) / 2);
      console.log(`  perso ${r * 5 + i + 1}: centre x = ${centre}  (label x ${s[0]}..${s[1]})`);
    });
  }
})();
