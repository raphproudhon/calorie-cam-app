// Extrait les 8 frames de rotation d'un GIF PixelLab en PNG individuels.
// Toutes les frames sont recadrees sur la MEME boite (union des pixels visibles
// de toutes les frames) pour que le personnage reste aligne quand on tourne
// (sinon il sautille d'un angle a l'autre).
//
// Usage : node tools/extract-rotations.js <fichier.gif> [dossier-sortie]
// Defaut : assets/hero/<le gif>  ->  assets/hero/rot/0.png..7.png

const { GifCodec } = require("gifwrap");
const Jimp = require("jimp");
const fs = require("fs");
const path = require("path");

const A = path.join(__dirname, "..", "assets");
const SRC = process.argv[2] || path.join(A, "hero", "Chibi_pixel_art_character_sprite_rotations_8dir.gif");
const DEST = process.argv[3] || path.join(A, "hero", "rot");

(async () => {
  const buf = fs.readFileSync(SRC);
  const gif = await new GifCodec().decodeGif(buf);
  const W = gif.width, H = gif.height;

  // Frames -> images Jimp.
  const imgs = gif.frames.map((f) => new Jimp({ data: Buffer.from(f.bitmap.data), width: f.bitmap.width, height: f.bitmap.height }));

  // Boite englobante commune (union des pixels non transparents de TOUTES les frames).
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (const im of imgs) {
    im.scan(0, 0, W, H, function (x, y, i) {
      if (this.bitmap.data[i + 3] > 16) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    });
  }
  // Petite marge autour.
  const M = 4;
  minX = Math.max(0, minX - M); minY = Math.max(0, minY - M);
  maxX = Math.min(W - 1, maxX + M); maxY = Math.min(H - 1, maxY + M);
  const cw = maxX - minX + 1, ch = maxY - minY + 1;

  // Agrandissement x4 en "plus proche voisin" : les pixels restent nets une
  // fois affiches en grand dans l'app (React Native flouterait sinon).
  const SCALE = 4;

  fs.mkdirSync(DEST, { recursive: true });
  for (let i = 0; i < imgs.length; i++) {
    await imgs[i]
      .clone()
      .crop(minX, minY, cw, ch)
      .resize(cw * SCALE, ch * SCALE, Jimp.RESIZE_NEAREST_NEIGHBOR)
      .writeAsync(path.join(DEST, `${i}.png`));
  }
  console.log(`${imgs.length} frames ${cw}x${ch} -> x${SCALE} (${cw * SCALE}x${ch * SCALE}) dans ${path.relative(path.join(__dirname, ".."), DEST)}/`);
})().catch((e) => { console.error("Echec :", e.message); process.exit(1); });
