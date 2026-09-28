// Prepare les sprites des personnages pour l'app, a partir des GIF PixelLab.
//
//   node tools/build-perso.js
//
// Entree : assets/perso/{humain,chat}/{h,c}{1..20}.gif — un GIF par etape,
// exporte tel quel de PixelLab. Chaque GIF contient les 8 DIRECTIONS du perso
// (une par frame : sud, sud-est, est, nord-est, nord, nord-ouest, ouest,
// sud-ouest), pas une animation.
//
// Sortie :
//   - assets/perso/{humain,chat}/rot/{etape}/{direction}.png : 8 PNG par etape ;
//   - perso-sprites.js : la table des require() (Metro exige des chemins
//     statiques, on ne peut pas les construire a l'execution).
//
// Deux traitements, tous deux necessaires a l'affichage :
//   1. Recentrage sur un canevas commun de 128 x 128. Les GIF n'ont pas tous la
//      meme taille (64, 96 puis 128 : le canevas a ete agrandi en cours de
//      route, sans redessiner le perso). Les agrandissements etant centres,
//      ajouter la meme marge de chaque cote remet les pieds exactement au meme
//      endroit d'une etape a l'autre : le perso ne saute pas en changeant
//      d'etape.
//   2. Agrandissement x4 au plus proche voisin (128 -> 512). Les ecrans
//      agrandissent les images en les lissant : sans ca, le pixel art serait
//      flou. On livre donc des pixels deja gros et nets.

const fs = require("fs");
const path = require("path");
const { GifUtil } = require("gifwrap");
const Jimp = require("jimp");

const RACINE = path.join(__dirname, "..");
const CANEVAS = 128;
const ECHELLE = 4;
const NB_ETAPES = 20;
const NB_DIRECTIONS = 8;
const PERSOS = [
  { id: "humain", prefixe: "h" },
  { id: "chat", prefixe: "c" },
];

/** Reconstitue les 8 images pleines d'un GIF (les frames peuvent etre decalees). */
async function framesPleines(fichier) {
  const gif = await GifUtil.read(fichier);
  const images = [];
  let precedente = null;
  for (const f of gif.frames) {
    // Base : l'image precedente (disposal "ne rien faire") ou un fond vide.
    const base = precedente && f.disposalMethod !== 2
      ? precedente.clone()
      : new Jimp(gif.width, gif.height, 0x00000000);
    const calque = new Jimp(f.bitmap.width, f.bitmap.height);
    calque.bitmap.data = Buffer.from(f.bitmap.data);
    base.composite(calque, f.xOffset, f.yOffset);
    images.push(base);
    precedente = base;
  }
  return { images, largeur: gif.width, hauteur: gif.height };
}

async function main() {
  const lignes = [];
  for (const { id, prefixe } of PERSOS) {
    const etapes = [];
    for (let e = 1; e <= NB_ETAPES; e++) {
      const source = path.join(RACINE, "assets/perso", id, `${prefixe}${e}.gif`);
      const { images, largeur, hauteur } = await framesPleines(source);
      if (images.length !== NB_DIRECTIONS) {
        throw new Error(`${source} : ${images.length} frames, 8 attendues`);
      }
      if (largeur > CANEVAS || hauteur > CANEVAS) {
        throw new Error(`${source} : ${largeur}x${hauteur}, plus grand que ${CANEVAS}`);
      }
      const dx = Math.round((CANEVAS - largeur) / 2);
      const dy = Math.round((CANEVAS - hauteur) / 2);
      const dossier = path.join(RACINE, "assets/perso", id, "rot", String(e));
      fs.mkdirSync(dossier, { recursive: true });

      const requires = [];
      for (let d = 0; d < NB_DIRECTIONS; d++) {
        const toile = new Jimp(CANEVAS, CANEVAS, 0x00000000);
        toile.composite(images[d], dx, dy);
        toile.resize(CANEVAS * ECHELLE, CANEVAS * ECHELLE, Jimp.RESIZE_NEAREST_NEIGHBOR);
        await toile.writeAsync(path.join(dossier, `${d}.png`));
        requires.push(`require("./assets/perso/${id}/rot/${e}/${d}.png")`);
      }
      etapes.push(`    [${requires.join(", ")}],`);
      console.log(`${id} ${e} : ${largeur}x${hauteur} -> ${CANEVAS * ECHELLE}px`);
    }
    lignes.push(`  ${id}: [\n${etapes.join("\n")}\n  ],`);
  }

  const module =
    "// FICHIER GENERE par tools/build-perso.js — ne pas modifier a la main.\n" +
    "// SPRITES[perso][etape 0..19][direction 0..7] : image 512 x 512 du perso.\n" +
    "// Directions : 0 = face, puis on tourne (sud-est, est, nord-est, dos, ...).\n\n" +
    `export const SPRITES = {\n${lignes.join("\n")}\n};\n`;
  fs.writeFileSync(path.join(RACINE, "perso-sprites.js"), module);
  console.log("perso-sprites.js ecrit");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
