// Decoupe une planche de vues d'un perso (image generee par une IA : Gemini,
// ChatGPT...) en 8 directions pretes pour tools/build-perso.js.
//
//   node tools/decouper-planche.js <planche.jpg|png> <dossier-sortie> <vues>
//
// La planche : le perso sous plusieurs angles, sur un fond uni (magenta de
// preference, absent du perso), en rangees. Les silhouettes sont reperees
// automatiquement et numerotees de gauche a droite, rangee par rangee (0, 1...).
//
// <vues> : 8 numeros, dans l'ordre des directions de l'app (face, 3/4 droite,
// profil droit, dos 3/4 droite, dos, dos 3/4 gauche, profil gauche, 3/4
// gauche). Un numero precede de "-" est pris en miroir : les IA ratent souvent
// les vues de gauche, on retourne alors la vue de droite correspondante.
//   ex : "0,1,2,6,4,-6,-2,8"
//
// Sortie : <dossier>/south.png, south-east.png... (256 x 256, fond
// transparent), meme hauteur de perso et pieds sur la meme ligne pour les 8
// vues : la rotation au doigt ne fait pas « sauter » le perso.

const fs = require("fs");
const path = require("path");
const Jimp = require("jimp");

const DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"];
const CANEVAS = 256;
const HAUTEUR_PERSO = 228; // px dans le canevas
const LIGNE_PIEDS = 246;   // y du bas des pieds

// Distance au fond en dessous de laquelle un pixel est du fond, et au-dessus
// de laquelle il est entierement du perso ; entre les deux, bord adouci (JPEG).
const SEUIL_FOND = 70;
const SEUIL_PERSO = 150;

async function main() {
  const [source, sortie, vuesTxt] = process.argv.slice(2);
  if (!source || !sortie || !vuesTxt) {
    console.error("Usage : node tools/decouper-planche.js <planche> <dossier-sortie> <8 vues, ex 0,1,2,6,4,-6,-2,8>");
    process.exit(1);
  }
  const vues = vuesTxt.split(",").map((v) => v.trim());
  if (vues.length !== 8) throw new Error("Il faut 8 vues");

  const img = await Jimp.read(source);
  const { width: W, height: H, data } = img.bitmap;
  const fond = [data[0], data[1], data[2]]; // coin haut gauche
  const dist = (i) => Math.abs(data[i] - fond[0]) + Math.abs(data[i + 1] - fond[1]) + Math.abs(data[i + 2] - fond[2]);
  const estPerso = (x, y) => dist((y * W + x) * 4) > SEUIL_PERSO - 40;

  // Rangees : bandes horizontales separees par des lignes vides.
  const parLigne = Array.from({ length: H }, (_, y) => {
    let n = 0;
    for (let x = 0; x < W; x++) if (estPerso(x, y)) n++;
    return n;
  });
  const bandes = segments(parLigne, 8, 40);
  // Silhouettes : dans chaque rangee, colonnes separees par des colonnes vides
  // (les fines lignes de sol dessinees par l'IA sont sous le seuil).
  const silhouettes = [];
  for (const [y0, y1] of bandes) {
    const parColonne = Array.from({ length: W }, (_, x) => {
      let n = 0;
      for (let y = y0; y < y1; y++) if (estPerso(x, y)) n++;
      return n;
    });
    for (const [x0, x1] of segments(parColonne, 6, 30)) {
      // Boite serree de la silhouette.
      let top = y1, bas = y0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        if (estPerso(x, y)) { top = Math.min(top, y); bas = Math.max(bas, y); }
      }
      // Ligne de sol dessinee par l'IA sous les pieds : une rangee basse qui
      // traverse presque toute la largeur de la silhouette. On remonte au-dessus.
      const pleine = (y) => {
        let n = 0;
        for (let x = x0; x < x1; x++) if (estPerso(x, y)) n++;
        return n > (x1 - x0) * 0.85;
      };
      while (bas > top && pleine(bas)) bas--;
      silhouettes.push({ x0, x1, top, bas });
    }
  }
  console.log(`${silhouettes.length} silhouettes :`, silhouettes.map((s, i) => `${i}:${s.x1 - s.x0}x${s.bas - s.top + 1}`).join(" "));

  fs.mkdirSync(sortie, { recursive: true });
  for (let d = 0; d < 8; d++) {
    const miroir = vues[d].startsWith("-");
    const s = silhouettes[Number(vues[d].replace("-", ""))];
    if (!s) throw new Error(`Vue ${vues[d]} introuvable`);
    const w = s.x1 - s.x0, h = s.bas - s.top + 1;
    const perso = new Jimp(w, h, 0x00000000);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = ((s.top + y) * W + (s.x0 + x)) * 4;
      const e = dist(i);
      const alpha = e <= SEUIL_FOND ? 0 : e >= SEUIL_PERSO ? 255 : Math.round(((e - SEUIL_FOND) / (SEUIL_PERSO - SEUIL_FOND)) * 255);
      if (!alpha) continue;
      let [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      // Anti-bavure : le magenta du fond deteint sur les bords (r ET b plus
      // forts que g, ce que n'a aucune couleur du perso) ; on les ramene vers g.
      if (r > g + 12 && b > g + 12) {
        const plafond = g + 8;
        r = Math.min(r, plafond);
        b = Math.min(b, plafond);
      }
      const j = (y * w + x) * 4;
      perso.bitmap.data[j] = r; perso.bitmap.data[j + 1] = g; perso.bitmap.data[j + 2] = b; perso.bitmap.data[j + 3] = alpha;
    }
    // Bord erode d'un pixel : le liseré reste du fond compresse (JPEG).
    const a0 = Buffer.from(perso.bitmap.data);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const j = (y * w + x) * 4 + 3;
      if (!a0[j]) continue;
      const voisinVide = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const xx = x + dx, yy = y + dy;
        return xx < 0 || yy < 0 || xx >= w || yy >= h || a0[(yy * w + xx) * 4 + 3] === 0;
      });
      if (voisinVide) perso.bitmap.data[j] = Math.round(a0[j] * 0.35);
    }
    if (miroir) perso.flip(true, false);
    // Meme hauteur pour toutes les vues, pieds sur la meme ligne.
    const echelle = HAUTEUR_PERSO / h;
    perso.resize(Math.round(w * echelle), HAUTEUR_PERSO, Jimp.RESIZE_BICUBIC);
    const toile = new Jimp(CANEVAS, CANEVAS, 0x00000000);
    toile.composite(perso, Math.round((CANEVAS - perso.bitmap.width) / 2), LIGNE_PIEDS - HAUTEUR_PERSO);
    await toile.writeAsync(path.join(sortie, `${DIRECTIONS[d]}.png`));
    console.log(`${DIRECTIONS[d]} <- vue ${vues[d]}`);
  }
}

/** Plages consecutives ou le compte depasse `seuil`, d'au moins `min` de long. */
function segments(comptes, seuil, min) {
  const out = [];
  let debut = -1;
  comptes.forEach((n, i) => {
    if (n > seuil && debut < 0) debut = i;
    if ((n <= seuil || i === comptes.length - 1) && debut >= 0) {
      if (i - debut >= min) out.push([debut, i]);
      debut = -1;
    }
  });
  return out;
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
