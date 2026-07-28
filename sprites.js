// Lecteur de sprites : rend un sprite pixel (grille + palette) en SVG natif.
//
// Format d'un sprite (exactement ce qu'exporte tools/sprite-studio.html) :
//   {
//     w: 32, h: 40,
//     palette: { "#": "#17121e", "S": "#f4cfa6", ... },  // char -> couleur
//     rows: [ "....##....", ... ],   // h chaines de w caracteres, " " = transparent
//   }
//
// Le meme fichier de sprite peut donc etre cree visuellement dans le studio,
// exporte, colle ici, et affiche tel quel dans l'app — sans image externe.

import Svg, { Rect } from "react-native-svg";

/**
 * Affiche un sprite. `pixel` = taille d'un pixel logique (en points RN).
 * On fusionne les pixels adjacents de meme couleur sur une ligne (run-length)
 * pour limiter le nombre de <Rect> — un sprite 32x40 plein passe ainsi de
 * ~1280 a quelques centaines de rectangles.
 */
export function Sprite({ spec, hauteur }) {
  if (!spec || !Array.isArray(spec.rows)) return null;
  const { w, h, palette, rows } = spec;
  const rects = [];

  for (let y = 0; y < rows.length; y++) {
    const ligne = rows[y];
    let x = 0;
    while (x < w) {
      const ch = ligne[x] || " ";
      const couleur = palette[ch];
      if (!couleur) { x++; continue; } // transparent
      // Longueur du segment de meme caractere.
      let len = 1;
      while (x + len < w && ligne[x + len] === ch) len++;
      rects.push(
        <Rect key={`${y}-${x}`} x={x} y={y} width={len} height={1} fill={couleur} />
      );
      x += len;
    }
  }

  // On dimensionne par la HAUTEUR voulue et on garde le ratio du sprite.
  const px = (hauteur || h * 4) / h;
  return (
    <Svg width={w * px} height={h * px} viewBox={`0 0 ${w} ${h}`}>
      {rects}
    </Svg>
  );
}
