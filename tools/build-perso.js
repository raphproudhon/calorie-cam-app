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
// Animations (facultatives) : assets/perso/{humain,chat}/anim/{nom}/{h,c}{etape}.gif
// — nom = idle, content, levelup, fatigue ou miam — un GIF PixelLab de
// l'animation vue de face, autant de frames que voulu. A la place du GIF, on
// peut deposer le dossier de frames de l'export ZIP de PixelLab (le dossier
// "south" de l'animation) sous le nom {h,c}{etape}/ : frame_000.png, ... Chacune devient UNE
// planche (frames en grille de COLONNES colonnes) dans
// assets/perso/{humain,chat}/anim/{nom}/{etape}.png : une seule image par
// animation, pour rester loin de la limite de 2000 fichiers d'une mise a jour
// Expo. Table : ANIMS[perso][etape 0..19][nom] = { planche, n, colonnes, ms }.
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
const COLONNES = 4;
const ANIMATIONS = ["idle", "content", "levelup", "fatigue", "miam"];
const PERSOS = [
  { id: "humain", prefixe: "h", canevas: CANEVAS },
  { id: "chat", prefixe: "c", canevas: CANEVAS },
];
const TAILLE_SORTIE = CANEVAS * ECHELLE; // 512 px, pour tous les persos

// Ordre des directions dans les GIF (et dans l'app) ; noms des fichiers du
// dossier "rotations" de l'export ZIP de PixelLab.
const DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"];

/** Les 8 directions d'une etape : GIF, ou dossier rotations/ de l'export ZIP. */
async function directionsEtape(base) {
  if (fs.existsSync(base + ".gif")) return framesPleines(base + ".gif");
  const images = [];
  for (const d of DIRECTIONS) images.push(await Jimp.read(path.join(base, `${d}.png`)));
  const { width, height } = images[0].bitmap;
  return { images, largeur: width, hauteur: height };
}

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
  const delais = gif.frames.map((f) => (f.delayCentisecs || 10) * 10);
  return { images, largeur: gif.width, hauteur: gif.height, delais };
}

// Duree d'une frame quand l'animation vient d'un dossier de PNG (l'export ZIP
// de PixelLab ne la donne pas) : ~8 images par seconde.
const MS_FRAME_PNG = 120;

/** Frames d'un dossier frame_000.png, frame_001.png... (export ZIP PixelLab). */
async function framesDossier(dossier) {
  const noms = fs.readdirSync(dossier).filter((n) => /\.png$/i.test(n)).sort();
  const images = [];
  for (const n of noms) images.push(await Jimp.read(path.join(dossier, n)));
  if (!images.length) throw new Error(`${dossier} : aucune frame PNG`);
  const { width, height } = images[0].bitmap;
  return { images, largeur: width, hauteur: height, delais: images.map(() => MS_FRAME_PNG) };
}

/** Une animation -> une planche PNG (grille de COLONNES colonnes, cases 512 x 512). */
async function planche(source, destination, CANEVAS) {
  const { images, largeur, hauteur, delais } = fs.statSync(source).isDirectory()
    ? await framesDossier(source)
    : await framesPleines(source);
  if (largeur > CANEVAS || hauteur > CANEVAS) {
    throw new Error(`${source} : ${largeur}x${hauteur}, plus grand que ${CANEVAS}`);
  }
  const dx = Math.round((CANEVAS - largeur) / 2);
  const dy = Math.round((CANEVAS - hauteur) / 2);
  const n = images.length;
  const colonnes = Math.min(COLONNES, n);
  const lignes = Math.ceil(n / colonnes);
  // Assemblee a l'echelle 1 puis agrandie d'un coup (plus proche voisin).
  const toile = new Jimp(CANEVAS * colonnes, CANEVAS * lignes, 0x00000000);
  images.forEach((img, k) => {
    toile.composite(img, (k % colonnes) * CANEVAS + dx, Math.floor(k / colonnes) * CANEVAS + dy);
  });
  const echelle = TAILLE_SORTIE / CANEVAS;
  toile.resize(toile.bitmap.width * echelle, toile.bitmap.height * echelle, Jimp.RESIZE_NEAREST_NEIGHBOR);
  await toile.writeAsync(destination);
  // Duree d'une frame : la mediane des delais du GIF (PixelLab les met egaux).
  const tries = [...delais].sort((a, b) => a - b);
  return { n, colonnes, ms: Math.max(40, tries[Math.floor(n / 2)]) };
}

async function main() {
  const lignes = [];
  const lignesAnims = [];
  for (const { id, prefixe, canevas: CANEVAS } of PERSOS) {
    const anims = [];
    for (let e = 1; e <= NB_ETAPES; e++) {
      const entrees = [];
      for (const nom of ANIMATIONS) {
        const base = path.join(RACINE, "assets/perso", id, "anim", nom, `${prefixe}${e}`);
        const source = [base + ".gif", base].find((f) => fs.existsSync(f));
        if (!source) continue;
        const dest = path.join(RACINE, "assets/perso", id, "anim", nom, `${e}.png`);
        const { n, colonnes, ms } = await planche(source, dest, CANEVAS);
        entrees.push(`${nom}: { planche: require("./assets/perso/${id}/anim/${nom}/${e}.png"), n: ${n}, colonnes: ${colonnes}, ms: ${ms} }`);
        console.log(`${id} ${e} ${nom} : ${n} frames, ${ms} ms`);
      }
      anims.push(`    { ${entrees.join(", ")} },`);
    }
    lignesAnims.push(`  "${id}": [\n${anims.join("\n")}\n  ],`);
    const etapes = [];
    for (let e = 1; e <= NB_ETAPES; e++) {
      const source = path.join(RACINE, "assets/perso", id, `${prefixe}${e}`);
      const { images, largeur, hauteur } = await directionsEtape(source);
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
        toile.resize(TAILLE_SORTIE, TAILLE_SORTIE, Jimp.RESIZE_NEAREST_NEIGHBOR);
        await toile.writeAsync(path.join(dossier, `${d}.png`));
        requires.push(`require("./assets/perso/${id}/rot/${e}/${d}.png")`);
      }
      etapes.push(`    [${requires.join(", ")}],`);
      console.log(`${id} ${e} : ${largeur}x${hauteur} -> ${TAILLE_SORTIE}px`);
    }
    lignes.push(`  "${id}": [\n${etapes.join("\n")}\n  ],`);
  }

  const module =
    "// FICHIER GENERE par tools/build-perso.js — ne pas modifier a la main.\n" +
    "// SPRITES[perso][etape 0..19][direction 0..7] : image 512 x 512 du perso\n" +
    "// Directions : 0 = face, puis on tourne (sud-est, est, nord-est, dos, ...).\n\n" +
    `export const SPRITES = {\n${lignes.join("\n")}\n};\n\n` +
    "// ANIMS[perso][etape 0..19][nom] : planche de l'animation vue de face\n" +
    "// (frames 512 x 512 en grille de `colonnes`), `n` frames de `ms` ms.\n" +
    `export const ANIMS = {\n${lignesAnims.join("\n")}\n};\n`;
  fs.writeFileSync(path.join(RACINE, "perso-sprites.js"), module);
  console.log("perso-sprites.js ecrit");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
