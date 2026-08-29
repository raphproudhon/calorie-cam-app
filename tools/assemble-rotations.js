// Assemble un export PixelLab "rotations" (8 PNG nommes par direction) en
// frames rotN/0..7.png pretes pour l'app : detourage vert si besoin, recadrage
// commun (union alpha) et agrandissement x4 (net).
//
// Usage : node tools/assemble-rotations.js <dossier-rotations> <dossier-sortie>
//   ex : node tools/assemble-rotations.js ".../Same_young_character/rotations" assets/hero/rot4

const Jimp = require("jimp");
const fs = require("fs");
const path = require("path");

const SRC = process.argv[2];
const DEST = process.argv[3];
if (!SRC || !DEST) { console.error("Usage: node tools/assemble-rotations.js <src> <dest>"); process.exit(1); }

// Ordre compas -> index : rotation continue et fluide au glissement (45 par 45).
const ORDRE = ["south", "south-west", "west", "north-west", "north", "north-east", "east", "south-east"];
const SCALE = 4;

(async () => {
  const imgs = [];
  for (const dir of ORDRE) {
    const f = path.join(SRC, dir + ".png");
    const im = await Jimp.read(f);
    // Detourage vert si le fond est un chroma green (sinon suppose transparent).
    const coin = Jimp.intToRGBA(im.getPixelColor(0, 0));
    if (coin.a > 10 && coin.g > 150 && coin.r < 120 && coin.b < 120) {
      im.scan(0, 0, im.bitmap.width, im.bitmap.height, function (x, y, i) {
        const r = this.bitmap.data[i], g = this.bitmap.data[i + 1], b = this.bitmap.data[i + 2];
        if (g - Math.max(r, b) > 40) this.bitmap.data[i + 3] = 0;
      });
    }
    imgs.push(im);
  }

  const W = imgs[0].bitmap.width, H = imgs[0].bitmap.height;
  // Boite englobante commune (union des pixels visibles de toutes les frames).
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (const im of imgs) im.scan(0, 0, W, H, function (x, y, i) {
    if (this.bitmap.data[i + 3] > 16) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  });
  const M = 4;
  minX = Math.max(0, minX - M); minY = Math.max(0, minY - M);
  maxX = Math.min(W - 1, maxX + M); maxY = Math.min(H - 1, maxY + M);
  const cw = maxX - minX + 1, ch = maxY - minY + 1;

  fs.mkdirSync(DEST, { recursive: true });
  for (let i = 0; i < imgs.length; i++) {
    await imgs[i].clone().crop(minX, minY, cw, ch)
      .resize(cw * SCALE, ch * SCALE, Jimp.RESIZE_NEAREST_NEIGHBOR)
      .writeAsync(path.join(DEST, i + ".png"));
  }
  console.log("8 frames " + cw + "x" + ch + " -> x" + SCALE + " (" + cw * SCALE + "x" + ch * SCALE + ") dans " + DEST);
})().catch((e) => { console.error("Echec:", e.message); process.exit(1); });
