# Système de personnage — cahier des charges & prompts PixelLab

Ce fichier remplace l'ancien `AVATAR.md` (consultable avec
`git show cb40e35:AVATAR.md`). Tout est repris de zéro : nouveau concept, deux
personnages, 20 étapes.

## Décisions prises

| Sujet | Choix |
|---|---|
| Personnages | **2, totalement indépendants** : un **humain** (épique / badass) et un **chat** (mignon / kawaii), inspiré d'une photo de vrai chat |
| Choix | à l'**onboarding**, **définitif** : on garde le même perso pour toute l'évolution, aucun lien entre les deux |
| Évolution | change d'**équipement** + physique **légèrement plus fort** à chaque étape |
| Nombre d'étapes | **20** par personnage |
| Paliers | on garde les 10 paliers existants et on en intercale 10 (voir plus bas) |
| Couleurs | **palette propre** à chaque perso ; le thème de l'app reste piloté par le niveau (`accentPourNiveau`) |
| Où il apparaît | partout où c'est légitime (Progression, Bilan, fin d'analyse, montée de niveau…) |
| Affichage | **rotation au doigt** (8 directions) **+ animations** |
| Réactions | oui : content, montée de niveau, fatigué, miam |
| Inspiration (humain) | *Solo Leveling* : **ombre et nécromancie**, jeune homme ordinaire qui s'éveille et devient un souverain. **Sans plagiat** : flamme verte et non violette, faux, crânes et mains spectrales au lieu d'une armée de soldats d'ombre |
| Effets flottants | **autorisés** (runes, étincelles, éclats…), à condition de rester dans le canevas |

## Concept

**Deux personnages totalement indépendants.** À l'onboarding, l'utilisateur
choisit **l'un ou l'autre**, et il le garde pour toute sa progression : pas
de changement possible ensuite, pas de lien entre les deux, jamais affichés
ensemble. Chacun a son propre univers, sa propre palette et ses propres
animations.

### L'humain — le Nécromancien (épique / badass)

Un jeune homme brun d'une vingtaine d'années, ordinaire, s'éveille à un pouvoir
d'**ombre et de nécromancie**. Son ombre prend vie, il appelle des crânes et des
mains spectrales, passe des dagues à la faux, et finit *Souverain des Tombes*.
Ses **yeux**, marron au départ, virent au **vert émeraude** à mesure que son
pouvoir grandit.

- Ce qui rappelle *Solo Leveling* : le jeune homme ordinaire qui s'éveille, le
  pouvoir d'ombre et de nécromancie, les dagues du début, les yeux qui
  s'allument, le manteau sombre, le titre de souverain.
- Ce qui l'en distingue : la **flamme spectrale verte** au lieu du violet, la
  **faux** au lieu des dagues à haut niveau, des **crânes et mains
  spectrales** au lieu d'une armée de soldats d'ombre, pas de réplique
  « Arise », pas de fenêtre « System ».

### Le chat — le Chat céleste (mignon / kawaii)

Un chaton ordinaire, inspiré d'un vrai chat (photo), s'éveille à une **flamme
spirituelle ambrée**. Il gagne des accessoires, puis des queues de flamme,
jusqu'à devenir un *Gardien céleste* à trois queues. Il reste rond et adorable
jusqu'au bout.

### Palettes

| Perso | Base | Accents | Fin de progression |
|---|---|---|---|
| Humain | noir, ombre fumée, blanc os | **vert émeraude** (flamme spectrale) | + touches d'**or sombre** aux étapes 19-20 |
| Chat | tigré brun et blanc (photo) | **ambre / or**, crème, rose pâle | flammes ambre + or, gemmes roses |

## Réglages PixelLab (communs aux deux persos)

| Réglage | Valeur |
|---|---|
| Taille du canevas | **64 × 64** : peu de pixels = gros pixels à l'écran (le style *Slayer Legend*) |
| Vue | **low top-down**, de face (même pose qu'avant) |
| Directions | **8** (pour la rotation au doigt) |
| Proportions | **chibi** |
| Contour | **contour noir épais** (single color black outline) |
| Ombrage | **basique** : 2 tons par couleur, fort contraste, pas de dégradé |
| Détail | **faible** |
| Fond | transparent |
| Frames par animation | **8** |

Méthode : **un personnage PixelLab par perso, un état (state) par étape**,
chaque état créé à partir du précédent.

**On repart de zéro, sans rien reprendre de l'ancien perso.** Créé de zéro,
PixelLab remplit tout le canevas : c'est donc **la taille du canevas qui fixe
la taille des pixels**. D'où le **64 × 64** : le perso fait ~55-60 px, et à
l'écran chaque pixel est gros, comme dans *Slayer Legend*. Les effets
flottants ont peu de place dans le canevas : l'app ajoutera la marge autour.

### Décision : canevas plus grand pour les étapes avancées (option 2)

À H8, le perso remplit toute la largeur du 64 × 64 (les mains spectrales sont
coupées aux bords), et il reste la faux, la cape, les ailes. Choix retenu :
**agrandir le canevas** à partir de H8, par exemple **96 × 96**, plutôt que de
tout rendre compact.

**Méthode A validée** : H7 agrandi à 96 × 96 dans PixelLab *sans être
redessiné*, puis H8 créé comme état de ce H7 agrandi. Résultat : perso de
**60 px de haut, mêmes pixels que H1-H7**, centré (boîte 16,19 → 81,79), les
mains spectrales à ~15 px des bords.

- **Dans l'app** : H1 à H7 (64 × 64) seront entourés de **16 px transparents
  de chaque côté** pour devenir 96 × 96. Les pieds tombent alors exactement au
  même endroit que sur H8 (ligne 79) : aucun saut entre les étapes.
- **Deuxième agrandissement fait à H15** : H14 agrandi à **128 × 128** (centré, +16 px de chaque côté), H15 créé dessus. Dans l'app : H1-H7 +32 px de chaque côté, H8-H14 +16 px, H15+ tels quels → tous en 128 × 128, pieds alignés.
- À refaire de la même façon si la place manque encore plus tard (ex. 128 × 128
  pour les ailes de H20) : agrandir le canevas, jamais redessiner.

### Ce que contiennent les GIF

Chaque GIF exporté de PixelLab contient **les 8 directions** du perso (sud,
sud-est, est, nord-est, nord, nord-ouest, ouest, sud-ouest), une par frame :
c'est la **rotation**, pas une animation. La frame 0 = vue de face. Dans l'app,
c'est directement la source de la rotation au doigt. Les animations (idle,
réactions) restent à générer.

### Règle de cadrage (la leçon de l'ancien système)

Avec l'ancien système, le perso rapetissait à chaque étape. La cause n'était pas
les effets, mais le recadrage automatique sur les pixels visibles. Deux règles
pour cette fois :

1. **Le code affichera toujours le canevas 64 × 64 entier, sans recadrage**,
   agrandi en « plus proche voisin » (pixels nets, jamais flous).
2. **Le perso garde la même hauteur à toutes les étapes.** Le bloc de cadrage le
   rappelle (`same size as the previous state`). Les effets
   flottants vont dans la marge autour, sans jamais sortir du cadre.

Si une étape sort plus petite ou plus grande que la précédente, on la régénère
plutôt que de la corriger en code.

## Style visuel : *Slayer Legend*

**Référence imposée : le style graphique de *Slayer Legend*** (RPG mobile idle,
icône de l'app : héros aux cheveux argentés, écharpe rouge, en pleine course).
On reprend le **style**, pas le personnage : pas de cheveux argentés, pas
d'yeux rouges, pas d'écharpe rouge.

Ce qui fait ce style :

- **très basse résolution** : de gros pixels bien visibles (perso dessiné sur
  ~50-60 px de haut) ;
- **super-déformé** : la **tête fait plus de la moitié de la hauteur**, petit
  corps, jambes très courtes ;
- **visage d'anime** : grands yeux colorés avec un reflet, sourcils marqués,
  nez absent, petite bouche ;
- **cheveux en mèches pointues** bien découpées ;
- **contour noir épais**, formes simples ;
- **couleurs très saturées et contrastées** : une tenue sombre + **un accent
  vif** qui ressort (chez eux l'écharpe rouge) ;
- **ombrage à 2 tons**, sans dégradé ;
- ⚠️ **on ne reprend PAS leur pose** (profil en pleine course) : notre perso
  reste **de face, pose neutre**, avec la rotation 8 directions ;
- **effets flashy** autour (traînées de feu, étincelles) : ça colle avec nos
  effets flottants.

Essais refusés, pour mémoire : trois H1 en 120-128 px (trop fins, trop
détaillés), et un nouvel état de l'ancien perso (bon rendu, mais il héritait
de l'ancien prompt).

## Bloc de style (à coller au DÉBUT de chaque prompt de création)

```text
Pixel art in the style of the mobile game Slayer Legend. Low resolution, big chunky pixels. Super-deformed chibi: huge head bigger than half of the total height, tiny body, very short legs. Anime face with big bright eyes with a white highlight, sharp eyebrows, no nose. Spiky, sharply cut hair strands. Thick black outline, simple bold shapes. Very saturated high-contrast colors, rich warm browns, deep charcoal, bright emerald green, dark outfit with one vivid accent color. Two-tone cel shading, no gradients.
```

## Bloc de cadrage (à coller à la FIN de chaque prompt de création)

```text
Full body, facing forward, static neutral pose, standing straight, arms relaxed at the sides, centered. Transparent background. Single character only.
```

Si PixelLab ignore la mention du jeu, retirer `in the style of the mobile game
Slayer Legend` : le reste du bloc décrit le style seul.

Pour les étapes suivantes (nouvel **état** de l'étape d'avant), pas besoin
des blocs : commencer par `Same character, same style and same size.`

## Humain — le Nécromancien (épique / badass)

**Jeune homme d'une vingtaine d'années, cheveux bruns en bataille, yeux
marron au départ.** Pouvoirs d'**ombre et de nécromancie**. Ses yeux
changent de couleur avec son pouvoir :

| Étapes | Yeux |
|---|---|
| 1-2 | marron, normaux |
| 3-5 | marron avec un reflet vert |
| 6-8 | vert noisette, légère lueur |
| 9-14 | vert émeraude lumineux |
| 15-18 | émeraude ardent, fines volutes vertes au coin des yeux |
| 19-20 | émeraude incandescent, cœur blanc |

Pour tous les prompts après le 1 : ils commencent par
`Same character, same face and same messy brown hair.` pour garder le même
visage d'un état à l'autre. Comme ce sont des **états** (pas de nouveaux
personnages), les blocs de style et de cadrage sont inutiles : ajouter
seulement `Same style and same size.` au début. **Seuls les yeux changent de couleur** : c'est
pourquoi chaque prompt redonne leur couleur.

### Acte I — l'Éveil

**H1 — L'inconnu** ✅ validé : `assets/perso/humain/h1.gif` (64 × 64, perso de 58 px, 31 couleurs). Nouveau personnage, bloc de style + ce texte + bloc de cadrage :
```text
A young man in his twenties, ordinary student: spiky messy brown hair, big bright warm brown eyes with a large white highlight, fully visible under the bangs, confident determined smirk. Dark charcoal grey hoodie with a vivid emerald green inner collar and drawstrings, dark jeans, white sneakers. No weapon, no armor, no powers.
```

**H2 — L'ombre qui bouge** ✅ `assets/perso/humain/h2.gif` (3ᵉ essai, nouvel état de H1 : lame argent, manche vert ; l'ombre au sol n'est pas sortie, il reste une petite volute)
```text
Same character, same style and same size. Same face, same spiky messy brown hair, same brown eyes, same confident smirk. Same charcoal hoodie with emerald green inner collar and dark jeans, now with black fingerless gloves. He holds a short knife in his right hand, blade pointing down, clearly visible against the dark hoodie: the blade is entirely bright shiny silver, no red anywhere, with a dark handle wrapped in a small touch of emerald green. Standing a little straighter. Under his feet, only a thin flat dark shadow, no wider than his shoulders, that does not go below his shoes and never touches the bottom edge of the canvas. A tiny black wisp of shadow rises from it beside his legs.
```

**H3 — L'éveil** ✅ `assets/perso/humain/h3.gif` (yeux verts, flamme verte ; les volutes d'ombre ne sont pas sorties, bottes au ras du bas)
```text
Same character, same face and same messy brown hair, brown eyes with a faint green glint. Dark grey hoodie, black cargo pants, combat boots, fingerless gloves. Holds a short steel dagger. Two or three small wisps of black shadow curl up beside his legs, not under his feet (no ground shadow, the feet are too close to the bottom edge), one tiny green ghost-fire wisp floating near his hand.
```

**H4 — Le blouson** ✅ `assets/perso/humain/h4.gif` (2ᵉ essai ; le 1ᵉʳ avait tourné la tête et perdu les yeux verts)
```text
Same character, same style and same size, feet at the same height as before. Keep the head, face and eyes exactly as before: facing forward, looking straight at the viewer, both eyes fully visible and glowing emerald green, same spiky messy brown hair, same confident smirk. Same silver knife with green-wrapped handle in his right hand, blade pointing down, sharp and clean. New: a black leather bomber jacket worn open over the charcoal hoodie, with a clearly visible emerald green lining and green cuffs so it stands out from the hoodie. Slightly broader shoulders. His left hand is raised to chest height, palm up, with the emerald green ghost-fire flame floating above it. Two tiny green sparks float around him.
```

Leçon : toujours écrire « keep the head, face and eyes exactly as before: facing forward… », sinon PixelLab tourne la tête.

**H5 — Premier appel** ✅ `assets/perso/humain/h5.gif` (nouvel état de H4 ; deux couteaux, crâne spectral ; le crâne et un couteau touchent les bords gauche/droit)
```text
Same character, same style and same size, feet at the same height as before. Keep the head, face and eyes exactly as before: facing forward, looking straight at the viewer, both eyes fully visible and glowing emerald green, same spiky messy brown hair, same confident smirk. Same open black bomber jacket with emerald green lining over the charcoal hoodie, same silver knife with green-wrapped handle in his right hand. New: the jacket now has a hood hanging on his back with torn, ragged edges, and a second identical silver knife in his left hand, both held in reverse grip. Athletic build. His first summon: a tiny white spectral skull with glowing emerald green eye sockets floats next to his head, with a faint green wisp trailing under it.
```

### Acte II — l'Adepte des ombres

**H6 — Le long manteau** ✅ `assets/perso/humain/h6.gif` (nouvel état de H5 ; la marge de 3 px a été ignorée, le crâne touche encore le bord droit)
```text
Same character, same style and same size, feet at the same height as before. Keep the head, face and eyes exactly as before: facing forward, looking straight at the viewer, both eyes fully visible and glowing emerald green, same spiky messy brown hair, same confident smirk. Same two silver knives with green-wrapped handles, one in each hand, held close to the body, blades pointing down. Same small white spectral skull with green eye sockets floating next to his head, but closer to him. New: the bomber jacket is replaced by a long black coat reaching his knees, open at the front over the charcoal hoodie, with emerald green lining and small bone-white buckles on the chest. Everything, including the skull and the knives, stays at least 3 pixels away from the edges of the canvas.
```

**H7 — Le harnais d'os** ✅ `assets/perso/humain/h7.gif` (2ᵉ essai depuis H6 : le 1ᵉʳ avait 2 crânes de dos. Garde les manches, harnais, brassards d'os, flammes au bout des lames, un seul crâne)
```text
Same character, same style and same size, feet at the same height as before. Keep the head, face and eyes exactly as before: facing forward, looking straight at the viewer, both eyes fully visible and glowing emerald green, same spiky messy brown hair, same confident smirk. Same long black coat with emerald green lining, same two silver knives with green-wrapped handles, same small white spectral skull with green eye sockets. New: under the open coat, the hoodie is replaced by a dark leather chest harness decorated with small bone ornaments, and bone-white bracers on both forearms. Slightly stronger, more muscular build. Tiny emerald green ghost-fire wisps flicker along both knife blades. Exactly ONE spectral skull in total, floating just above his left shoulder, the same single skull seen from every direction: never two skulls, including from the back.
```

**H8 — Les mains de l'ombre** ✅ `assets/perso/humain/h8.gif` (**96 × 96**, état de H7 agrandi sans redessin)
```text
Same character, same style and same size, feet at the same height as before. Keep the head, face and eyes exactly as before: facing forward, looking straight at the viewer, both eyes fully visible and glowing emerald green, same spiky messy brown hair, same confident smirk. Same long black coat with sleeves and emerald green lining, same bone-decorated leather harness, same bone-white bracers, same two silver knives with green ghost-fire at the tips, exactly one small white spectral skull above his left shoulder (never two, from any direction). New: the coat now has a tall high collar framing his jaw, and thin glowing emerald green seams running down the coat. Two small spectral skeletal hands made of translucent green light float on either side of his waist, fingers curled as if ready to grab.
```

**H9 — L'épaulière crâne** ✅ `assets/perso/humain/h9.gif` (2ᵉ essai ; PixelLab a mis une épaulière crâne sur **les deux** épaules, symétrique : gardé. Les lames ne sont pas plus enflammées)
```text
Same character, same style and same pixel size, feet at the same height as before, do not enlarge him to fill the canvas. Keep the head, face and eyes exactly as before: facing forward, looking straight at the viewer, both eyes fully visible and glowing emerald green, same spiky messy brown hair, same confident smirk. Same long black coat with high collar, emerald green lining and glowing green seams, same bone-decorated harness, same bone-white bracers, same two spectral green skeletal hands at his waist, exactly one small white spectral skull above his left shoulder (never two, from any direction). New: a dark armored shoulder pad shaped like a skull on his right shoulder, with small glowing green eye sockets. Both silver knives now drip with emerald green ghost-fire along the whole blade. Nothing touches the edges of the canvas.
```

**H10 — Le capuchon** ✅ `assets/perso/humain/h10.gif` (capuche relevée, yeux verts dans l'ombre ; 2 crânes visibles de face au lieu de 3)
```text
Same character, same style and same pixel size, feet at the same height as before, do not enlarge him to fill the canvas. Same face, same confident smirk, both eyes fully visible and glowing brighter emerald green. Same long black coat with emerald green lining and glowing green seams, same two bone-white skull shoulder pads with green eye sockets, same bone-decorated harness, same bone-white bracers, same two silver knives, same two spectral green skeletal hands at his waist. New: he now wears the coat's black hood raised over his head, a few spiky brown hair strands sticking out, his face still fully visible and lit by his glowing green eyes. Instead of one floating skull, exactly three small white spectral skulls with green eye sockets now float in a loose circle around his upper body, all inside the canvas. Nothing touches the edges of the canvas.
```

### Acte III — le Nécromancien

**H11 — La faux** ✅ `assets/perso/humain/h11.gif` (3ᵉ essai depuis H10 : faux en diagonale à deux mains, grande lame vert lumineux à droite, crânes remontés au-dessus des épaules)
```text
Same character, same style and same pixel size, feet at the same height as before, do not enlarge him to fill the canvas. Same face under the raised black hood, same confident smirk, both eyes glowing emerald green, plus a small scar on his cheek. Same long black coat with emerald green lining and glowing green seams, same two bone-white skull shoulder pads, same bone-decorated harness, same bone-white bracers, same two spectral green skeletal hands, same floating spectral skulls. New: the two knives are gone; instead he holds a black scythe diagonally across his body with both hands, the shaft going from his lower left (bottom left of the image) up to his upper right (top right of the image), and the curved blade at the top right, glowing with emerald green ghost-fire and curving over his shoulder. The whole scythe, blade included, stays inside the canvas. Nothing touches the edges of the canvas.
```

**H12 — La cape déchirée** ✅ `assets/perso/humain/h12.gif` (cape en lambeaux et braises vertes en bas, veines vertes sur les avant-bras ; effet discret)
```text
Same character, same style and same pixel size, feet at the same height as before, do not enlarge him to fill the canvas. Same face under the raised black hood, same confident smirk, both eyes glowing emerald green. Same long black coat with emerald green lining and glowing green seams, same two bone-white skull shoulder pads, same bone-decorated harness, same two spectral green skeletal hands, same floating spectral skulls, same black scythe held diagonally across his body with both hands, with its large bright glowing emerald green blade on the right side, same two floating skulls above his shoulders. New: a tattered black cape hangs from his shoulders behind him, its ragged bottom edge dissolving into wisps of black smoke with a few green embers. Thin glowing emerald green veins now run along his forearms and hands. The cape stays close behind him and inside the canvas. Nothing touches the edges of the canvas.
```

**H13 — Les gantelets** ✅ `assets/perso/humain/h13.gif` (gantelets noirs, manche en flamme verte, éclairs ; la peau est devenue plus pâle/grisâtre)
```text
Same character, same style and same pixel size, feet at the same height as before, do not enlarge him to fill the canvas. Same face under the raised black hood, same confident smirk, both eyes glowing emerald green. Same long black coat with emerald green lining and glowing green seams, same two bone-white skull shoulder pads, same tattered black cape with green embers, same two spectral green skeletal hands, same two floating skulls above his shoulders, same black scythe held diagonally with both hands with its large bright green blade on the right. New: his hands now wear black clawed armored gauntlets with glowing emerald green knuckles and sharp claw tips. Emerald green ghost-fire now also runs along the whole scythe shaft, and small crackling green lightning sparks jump off the blade. Nothing touches the edges of the canvas.
```

**H14 — Les flammes spectrales** ✅ `assets/perso/humain/h14.gif` (2ᵉ essai : le 1ᵉʳ avait une capuche vide sans visage. Leçon : écrire « face must stay fully visible… never a dark empty hood » EN TÊTE du prompt)
```text
Same character, same style and same pixel size, feet at the same height as before, do not enlarge him to fill the canvas. Same face under the raised black hood, same pale skin, same confident smirk. His emerald green eyes now blaze brighter, with thin green wisps of light trailing from the corners of his eyes. Same long black coat with glowing green seams, same tattered black cape, same black clawed gauntlets, same two spectral green skeletal hands, same two floating skulls above his shoulders, same black scythe held diagonally with green ghost-fire along the shaft and its large bright green blade on the right. New: emerald green ghost-fire now burns on top of both bone-white skull shoulder pads, like two small green flames rising from the skulls. Nothing touches the edges of the canvas.
```

> **Idée validée : la double faux à H15.** À la fin de l'acte III, la faux
> devient une **double faux** : une lame à chaque bout du manche, tenue en
> diagonale (lame en haut à droite ET en bas à gauche). À H18, les deux lames
> deviennent de la flamme verte pure. Prompts de H15 et H18 à adapter le
> moment venu.

**H15 — Le seigneur des tombes : la double faux** ✅ `assets/perso/humain/h15.gif` (**128 × 128** : H14 agrandi sans redessin, puis H15 ; rien ne touche les bords)
```text
Same character, same style and same pixel size, feet at the same height as before, do not enlarge him to fill the canvas. IMPORTANT: his face must stay fully visible and lit inside the hood, exactly as before: same pale skin, same confident smirk, both blazing emerald green eyes with green wisps at the corners, never a dark empty hood. Same raised black hood, same tattered black cape, same black clawed gauntlets, same green flames on the skull shoulder pads, same two spectral green skeletal hands, same two floating skulls above his shoulders. New: his scythe becomes a DOUBLE scythe, still held diagonally with both hands: the same large bright green blade at the top right end of the shaft, plus a second identical bright green curved blade at the bottom left end of the shaft. His coat is now reinforced with dark armor plates on the chest, engraved with small glowing green runes. Nothing touches the edges of the canvas.
```

### Acte IV — le Souverain des Tombes

**H16 — L'armure gravée** ✅ `assets/perso/humain/h16.gif` (armure gravée blanc os et runes vertes, cape à doublure verte)
```text
Same character, same style and same pixel size, feet at the same height as before, do not enlarge him to fill the canvas. IMPORTANT: his face must stay fully visible and lit inside the hood, exactly as before: same pale skin, same confident smirk, both blazing emerald green eyes with long green wisps at the corners, never a dark empty hood. Same raised black hood, same black clawed gauntlets, same green flames on the skull shoulder pads, same two spectral green skeletal hands, same two floating skulls, same double scythe held diagonally with its two large bright green blades. New: his coat becomes ornate dark armor engraved with bone-white patterns and glowing green runes, and the tattered cape becomes a long black cape with an emerald green inner lining, flowing behind him. Nothing touches the edges of the canvas.
```

**H17 — La mèche blonde** ✅ `assets/perso/humain/h17.gif` (3ᵉ essai : cheveux bruns + une mèche blonde, bord de capuche vert lumineux ; un essai avait rendu tous les cheveux blancs)
```text
Same character, same style and same pixel size, feet at the same height as before, do not enlarge him to fill the canvas. IMPORTANT: his face must stay fully visible and lit inside the hood, exactly as before: same pale skin, same confident smirk, both blazing emerald green eyes with long green wisps at the corners, never a dark empty hood. Same raised black hood, same ornate engraved dark armor with green runes, same long black cape with green lining, same black clawed gauntlets, same green flames on the skull shoulder pads, same two spectral green skeletal hands, same two floating skulls, same double scythe with its two large bright green blades. New: a clearly visible bone-white streak of hair falls from under the hood across his forehead, contrasting with his brown hair. Tiny emerald green particles slowly rise around his whole body like embers. Nothing touches the edges of the canvas.
```

**H18 — La faux des âmes** ✅ `assets/perso/humain/h18.gif` (lames en flamme, arc de runes ; le manche noir a presque disparu)
```text
Same character, same style and same pixel size, feet at the same height as before, do not enlarge him to fill the canvas. IMPORTANT: his face must stay fully visible and lit inside the hood, exactly as before: same pale skin, same confident smirk, same glowing emerald green eyes, same dark brown hair with one golden blonde strand, never a dark empty hood. Same black hood with glowing green outline, same ornate engraved dark armor with green runes, same long black cape with green lining, same black clawed gauntlets, same green flames on the skull shoulder pads, same two spectral green skeletal hands, same two floating skulls. New: both blades of his double scythe are now made entirely of solid bright emerald green ghost-fire, flickering like flames. A loose circle of small glowing green necromantic runes floats around him at waist height. Nothing touches the edges of the canvas.
```

**H19 — La couronne d'os** ✅ `assets/perso/humain/h19.gif` (couronne d'os, gravures dorées ; crânes et mains spectrales plus sombres, manche toujours peu visible)
```text
Same character, same style and same pixel size, feet at the same height as before, do not enlarge him to fill the canvas. IMPORTANT: his face must stay fully visible and lit inside the hood, exactly as before: same pale skin, same confident smirk, same glowing emerald green eyes, same dark brown hair with one golden blonde strand, never a dark empty hood. Same black hood with glowing green outline, same ornate engraved dark armor, same long black cape with green lining, same black clawed gauntlets, same green flames on the skull shoulder pads, same two spectral green skeletal hands, same two floating skulls, same double scythe with blades of green ghost-fire and its black shaft clearly visible, same runes. New: a thin crown of bone-white spikes sits on top of his hood, and his armor now has dark gold engravings along with the green runes. The edge of his cape burns with a thin line of green ghost-fire. Nothing touches the edges of the canvas.
```

**H20 — Le Souverain des Tombes** ✅ `assets/perso/humain/h20.gif` (forme finale : ailes d'ombre et de flamme verte vers le haut ; rien ne touche les bords en 128 × 128)
```text
Same character, same style and same pixel size, feet at the same height as before, do not enlarge him to fill the canvas. IMPORTANT: his face must stay fully visible and lit inside the hood, exactly as before: same pale skin, same confident smirk, same dark brown hair with one golden blonde strand, never a dark empty hood; his emerald green eyes now blaze with a white-hot core. Same crown of bone spikes on the hood, same black hood with glowing green outline, same ornate dark armor with gold engravings, same cape, same black clawed gauntlets, same green flames on the skull shoulder pads, same two floating white skulls, same double scythe with blades of green ghost-fire. New: a pair of large wings made of black shadow smoke and emerald green ghost-fire rises from his back, pointing UPWARD above his shoulders (not spread sideways), staying inside the canvas. Regal, overwhelming presence. Nothing touches the edges of the canvas.
```

Si les ailes touchent les bords : agrandir H19 à 160 × 160 sans redessin (méthode A) puis refaire H20.

---

## Chat — le Chat céleste (mignon / kawaii)

Inspiré d'un vrai chat (deux photos reçues) : **tigré brun et blanc**.

| Zone | Pelage |
|---|---|
| Dessus de la tête, oreilles, dos, flancs | tigré brun-gris à rayures sombres |
| Front | **fine bande blanche** qui monte au milieu, entre les yeux |
| Museau | blanc, avec une **tache tigrée brune autour du nez rose** |
| Menton, poitrail, ventre, pattes avant | blanc, **pattes blanches** |
| Queue | tigrée, plus sombre au bout |
| Yeux | **verts** (virent à l'ambre lumineux à partir de C10) |
| Oreilles | intérieur rose |

Les signes distinctifs à ne pas perdre d'une étape à l'autre : **la bande
blanche du front, le plastron blanc et les pattes blanches.** Si PixelLab les
oublie, régénérer.

Pour tous les prompts après le 1 : ils commencent par
`Same cat, same fur pattern and same face.`
C2 à C9 gardent ses yeux verts ; à partir de C10 ils brillent d'ambre.

### Acte I — le Chaton

**C1 — Le chaton** ✅ `assets/perso/chat/c1.gif` (64 × 64 ; nouveau perso puis état correctif pour le trait blanc du front : les 4 repères sont là)
```text
A tiny cute kitten, brown tabby and white bicolor: brown-grey tabby with dark stripes on the top of the head, ears, back, sides and tail; a thin white stripe on the forehead that stops at eye level; between and below the eyes the nose bridge is brown tabby, and the pink nose sits in that brown patch; the white only starts under the nose, on the mouth, cheeks and chin; white chin, chest, belly and front legs with white paws; pink inner ears; darker tail tip. Huge sparkly green eyes, round face, small pink nose, sitting, happy expression. No accessories, no effects. Kawaii style.
```

**C2 — Le grelot** ✅ `assets/perso/chat/c2.gif` (collier rouge et grelot doré)
```text
Same character, same style and same size. Same kitten, same pose, same fur pattern: same thin white stripe on the forehead, same brown tabby patch around the pink nose, same white chest and white paws, same huge sparkly green eyes, same happy expression. New: a small red collar around his neck with a shiny round golden bell hanging in front, clearly visible on the white chest. Nothing touches the edges of the canvas.
```

**C3 — L'écharpe** ✅ `assets/perso/chat/c3.gif` (écharpe crème + grelot, étincelle ambrée ; l'étincelle frôle les bords sur 4 vues : 1 px touché)
```text
Same character, same style and same size. Same kitten, same pose, same fur pattern: same thin white stripe on the forehead, same brown tabby patch around the pink nose, same white chest and white paws, same huge sparkly green eyes, same happy expression. New: the red collar is replaced by a small soft cream-colored scarf knotted around his neck, with the same shiny golden bell hanging from the knot. One tiny amber sparkle floats next to his head. Nothing touches the edges of the canvas.
```

**C4 — Première étincelle** ✅ `assets/perso/chat/c4.gif` (**96 × 96** : C3 agrandi sans redessin ; bout de queue lumineux, étincelles ambrées)
```text
Same character, same style and same pixel size, same position, do not enlarge him to fill the canvas. Same kitten, same pose, same fur pattern: same thin white stripe on the forehead, same brown tabby patch around the pink nose, same white chest and white paws, same huge sparkly green eyes, same happy expression, same cream scarf with golden bell. New: the tip of his tail now glows with a small warm amber light, and two tiny amber sparkles float around him, close to his body. Nothing touches the edges of the canvas.
```

**C5 — La petite cape** ✅ `assets/perso/chat/c5.gif` (cape crème et ambre, surtout visible de côté et de dos)
```text
Same character, same style and same pixel size, same position, do not enlarge him to fill the canvas. Same kitten, same pose, same fur pattern: same thin white stripe on the forehead, same brown tabby patch around the pink nose, same white chest and white paws, same huge sparkly green eyes, same cream scarf, same glowing amber tail tip, same amber sparkles. New: a tiny adventurer cape in cream and amber hangs from his shoulders, and the golden bell now glows softly with a warm amber light. Proud, adorable expression. Nothing touches the edges of the canvas.
```

### Acte II — l'Apprenti

**C6 — Le harnais** ✅ `assets/perso/chat/c6.gif` (harnais de cuir brun et petites sacoches)
```text
Same character, same style and same pixel size, same position, do not enlarge him to fill the canvas. Same kitten, slightly bigger and more confident, same fur pattern: same thin white stripe on the forehead, same brown tabby patch around the pink nose, same white chest and white paws, same huge sparkly green eyes, same cream scarf with glowing golden bell, same cream and amber cape, same glowing amber tail tip, same amber sparkles. New: a small brown leather harness across his chest with a tiny round pouch on his side. Nothing touches the edges of the canvas.
```

**C7 — La flamme de la queue** ✅ `assets/perso/chat/c7.gif` (petite flamme ambrée au bout de la queue, visible sous tous les angles)
```text
Same character, same style and same pixel size, same position, do not enlarge him to fill the canvas. Same kitten, same pose, same fur pattern: same thin white stripe on the forehead, same brown tabby patch around the pink nose, same white chest and white paws, same huge sparkly green eyes, same cream scarf with glowing golden bell, same cream and amber cape, same brown leather harness with pouch, same amber sparkles. New: the tip of his tail now burns with a small cute amber spirit flame, clearly visible from every direction, instead of just glowing. Nothing touches the edges of the canvas.
```

**C8 — Le plastron** (2ᵉ essai gardé en attendant dans `assets/perso/chat/c8.gif` ; à refaire : retirer l'écharpe pour qu'on voie le plastron de face)
```text
Same character, same style and same pixel size, same position, do not enlarge him to fill the canvas. Same kitten, same pose, same fur pattern: same thin white stripe on the forehead, same brown tabby patch around the pink nose, same white paws, same huge sparkly green eyes, same cream scarf with glowing golden bell, same cream and amber cape, same brown leather harness, same amber spirit flame on the tail tip, same amber sparkles. New: a tiny shiny golden chest plate over his white chest, rounded and cute, fixed to the harness. Brave, adorable expression. Nothing touches the edges of the canvas.
```

**C9 — Les runes-pattes** (nouvel état de C8)
```text
Same character, same style and same pixel size, same position, do not enlarge him to fill the canvas. Same kitten, same pose, same fur pattern: same thin white stripe on the forehead, same brown tabby patch around the pink nose, same white paws, same huge sparkly green eyes, no scarf, same golden chest plate with the golden bell in its center, same cream and amber cape, same brown leather harness, same amber spirit flame on the tail tip. New: the small sparkles are replaced by three small glowing amber paw-print runes floating in the air around him, clearly visible from every direction. Nothing touches the edges of the canvas.
```

**C10 — Les yeux ambre**
```text
Same cat, same fur pattern and same face, its big eyes now glowing warm amber. Tiny golden chest plate, small cape, glowing bell, amber spirit flame on the tail. Little amber flame wisps and paw-print runes float around it. Kawaii style.
```

### Acte III — l'Esprit

**C11 — La deuxième queue**
```text
Same cat, same fur pattern and same face, glowing amber eyes. Now a young adult cat, still cute and round. A second translucent spectral amber tail appears next to its real tail. Golden chest plate, small cape. Amber wisps float around it. Kawaii style.
```

**C12 — La marque au front**
```text
Same cat, same fur pattern and same face, glowing amber eyes, a small glowing golden mark on its forehead. Two tails, one spectral amber. Golden chest plate, cape with gold trim. Amber wisps float around it. Kawaii style.
```

**C13 — Les pattes de feu**
```text
Same cat, same fur pattern and same face, glowing amber eyes, golden forehead mark. Tiny golden armored paw guards with small amber spirit flames around its paws. Two tails, golden chest plate, cape. Amber wisps float around it. Kawaii style.
```

**C14 — Les feux follets**
```text
Same cat, same fur pattern and same face, glowing amber eyes, golden forehead mark. Golden paw guards with amber flames, two tails, chest plate, cape. Three small round amber will-o'-the-wisp orbs orbit around it. Kawaii style.
```

**C15 — Deux queues de flamme**
```text
Same cat, same fur pattern and same face, glowing amber eyes, golden forehead mark. Both tails now burn with bright amber spirit flames. Golden chest plate, golden paw guards, cape with gold trim, a tiny pink gem on its collar. Amber orbs orbit around it. Confident and adorable. Kawaii style.
```

### Acte IV — le Gardien céleste

**C16 — Trois queues**
```text
Same cat, same fur pattern and same face, glowing amber eyes, golden forehead mark. Three flaming amber spirit tails. Ornate golden collar with a pink gem, golden chest plate and paw guards, cape. Amber orbs orbit around it. Kawaii style.
```

**C17 — Les petites ailes**
```text
Same cat, same fur pattern and same face, glowing amber eyes, golden forehead mark. Small cute spectral wings made of amber light on its back. Three flaming tails, ornate golden collar with pink gem, golden armor pieces. Amber orbs orbit around it. Kawaii style.
```

**C18 — La couronne de flammes**
```text
Same cat, same fur pattern and same face, glowing amber eyes, golden forehead mark. A small crown of floating amber flames above its head. Small spectral amber wings, three flaming tails, ornate golden collar and armor. Kawaii style.
```

**C19 — Le halo**
```text
Same cat, same fur pattern and same face, glowing amber eyes, golden forehead mark. Larger spectral amber-and-gold wings, a glowing golden halo, crown of floating flames, three flaming tails, ornate golden armor. Tiny golden stars float around it. Kawaii style.
```

**C20 — Le Gardien céleste**
```text
Same cat, same fur pattern and same face, radiant golden eyes, glowing golden forehead mark. A small golden crown, a halo of amber flames, large majestic spectral wings of amber and gold light, three blazing spirit tails, ornate golden armor with pink gems. Tiny stars and amber orbs float around it. Still round, tiny and adorable. Kawaii style.
```

---

## Animations (8 frames chacune)

À générer pour chaque état, **direction sud (face caméra) uniquement** : la
rotation au doigt utilise les 8 images fixes de l'état, pas besoin d'animer les
8 directions.

| Animation | Quand elle joue dans l'app | Humain | Chat |
|---|---|---|---|
| **idle** (boucle) | tout le temps | `breathing idle, subtle chest movement, cape and hair sway slightly, floating effects gently bob, seamless loop` | `cute breathing idle, slow blink, tail swaying, ears twitch, floating effects gently bob, seamless loop` |
| **content** | journée dans la cible | `confident nod and small fist pump, eyes glow brighter, returns to idle pose` | `happy hop in place, eyes closed smiling, tail wiggles, returns to idle pose` |
| **level up** | montée de niveau / nouvelle étape | `power-up: raises weapon, shadows surge from the ground, burst of green ghost-fire, eyes flare, returns to idle pose` | `jumps up joyfully, burst of amber sparkles and hearts, lands back in idle pose` |
| **fatigué** | série cassée | `shoulders drop, head lowers, sighs, effects dim, slowly straightens back` | `ears flatten, sad pout, sits down, tail curls, then looks up hopeful` |
| **miam** | après une analyse de repas | `takes a bite of a small food item, satisfied expression, returns to idle` | `happily munches a tiny fish snack, cheeks puffed, returns to idle` |

Garder le même point d'appui (les pieds) sur les 8 frames, sinon le perso
« saute » dans son cadre.

### Ordre de génération conseillé

20 étapes × 2 persos × 5 animations = 200 animations. C'est beaucoup, donc
on avance par couches :

1. **Humain H1 + chat C1** : états, 8 rotations, idle. On les intègre dans
   l'app pour valider le rendu (taille, cadrage, lisibilité) **avant** de
   continuer.
2. Les 20 états + l'**idle** de chaque perso.
3. Les réactions, étape par étape. Tant qu'une réaction manque pour une étape,
   l'app joue l'idle avec un petit effet en code (rebond, secousse) : rien ne
   bloque.

## Paliers des 20 étapes

Les 10 paliers existants (`PALIERS_COULEUR`) sont gardés tels quels (en
**gras**) ; on en intercale 10 pour arriver à 20. Durée indicative calculée à
~65 XP/jour (journée loggée + cible + pesée), le rythme d'un utilisateur
régulier.

| Étape | Niveau | ≈ jours |
|---|---|---|
| 1 | **1** | 0 |
| 2 | **2** | 1 |
| 3 | 3 | 2 |
| 4 | **4** | 4 |
| 5 | 5 | 7 |
| 6 | **6** | 11 |
| 7 | 7 | 16 |
| 8 | **9** | 28 |
| 9 | 11 | 42 |
| 10 | **13** | 60 |
| 11 | 15 | 80 |
| 12 | **18** | 120 |
| 13 | 21 | 160 |
| 14 | **24** | 210 |
| 15 | 27 | 270 |
| 16 | **31** | 360 |
| 17 | 35 | 460 |
| 18 | **40** | 600 |
| 19 | 45 | 760 |
| 20 | 50 | 940 |

Le début va vite (5 étapes en une semaine, pour accrocher). La fin prend
deux à trois ans : c'est la longévité voulue.

## Reste à faire

- [x] H1 validé (`assets/perso/humain/h1.gif`)
- [x] H2
- [x] H3
- [x] H4
- [x] H5 (fin de l'acte I)
- [x] H6
- [x] H7
- [x] H8 (canevas 96 × 96 à partir d'ici)
- [x] H9
- [x] H10 (fin de l'acte II)
- [x] H11
- [x] H12
- [x] H13
- [x] H14
- [x] H15 (canevas 128 × 128 à partir d'ici)
- [x] H16
- [x] H17
- [x] H18
- [x] H19
- [x] H20 — **les 20 étapes de l'humain sont faites** (rotations 8 directions)
- [ ] Humain : animations (idle + réactions)
- [ ] Dans l'app : entourer H1-H7 de 16 px transparents (64 → 96), chacun en nouvel état du précédent
- [ ] Dans l'app : raviver un peu la saturation du sprite si besoin (PixelLab rend des couleurs ternes)
- [x] H2
- [x] H3
- [x] H4
- [x] H5 (fin de l'acte I)
- [x] H6
- [x] H7
- [x] H8 (canevas 96 × 96 à partir d'ici)
- [x] H9
- [x] H10 (fin de l'acte II)
- [x] H11
- [x] H12
- [x] H13
- [x] H14
- [x] H15 (canevas 128 × 128 à partir d'ici)
- [x] H16
- [x] H17
- [x] H18
- [x] H19
- [x] H20 — **les 20 étapes de l'humain sont faites** (rotations 8 directions)
- [ ] Humain : animations (idle + réactions)
- [ ] Dans l'app : entourer H1-H7 de 16 px transparents (64 → 96), chacun en nouvel état du précédent, en vérifiant ~60 px de haut
- [x] C1 (`assets/perso/chat/c1.gif`)
- [x] C2
- [x] C3 (64 × 64)
- [x] C4 (canevas 96 × 96 à partir d'ici)
- [x] C5 (fin de l'acte I)
- [x] C6
- [x] C7
- [x] C8
- [ ] C9 → C20
- [ ] Tester H1 dans l'app (affichage agrandi, pixels nets)
- [ ] Code : choix du perso à l'onboarding (persisté dans `stockage.js`, non modifiable ensuite)
- [ ] Code : `PALIERS_PERSO` (20 étapes) dans `jeu.js`, composant d'affichage
      (rotation + animations + réactions) dans `App.js`
