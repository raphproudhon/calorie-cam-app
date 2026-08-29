# Avatar du héros — prompts & workflow

Ce fichier permet de **reprendre la création des personnages depuis n'importe
quel appareil**. Il contient les prompts, la progression prévue, et la marche à
suivre pour intégrer un niveau.

## Concept

Un seul personnage qui **évolue sur 10 niveaux** : d'un ado ordinaire (niveau 1)
jusqu'à un **souverain de flammes** (niveau 10). Style **chibi pixel art 16-bit**.

- **Identité de pouvoir = ROUGE / OR (feu & sang).** Volontairement PAS violet +
  ombres, pour ne PAS ressembler à Solo Leveling. Base sombre (noir/charbon),
  accents **cramoisi** + **or** ; les yeux **s'embrasent en ambre/rouge** aux
  hauts niveaux (yeux bleus naturels au départ).
- **Pas d'aura ni de glow ambiant dans le sprite** : les flammes/effets sont
  peints en **pixels nets et solides faisant partie du perso**. Le halo lumineux
  autour (rouge/orange) est ajouté **en code** dans l'app et monte avec le niveau.
- **Cohérence** : toujours « same face and hair as before ». Sur PixelLab, chaque
  niveau = un **state** du même personnage.

## Qualité / résolution

À générer en **128×128** (taille du niveau 1), **fond transparent**, **8 directions**.
Garder la MÊME taille pour tous les niveaux, pour un détail homogène.

## Outil recommandé

**PixelLab.ai** — sprites cohérents, fond transparent, rotations 8 directions.
Un *state* par niveau. Alternatives : Retro Diffusion, Midjourney (`--cref`).

## Leçons apprises (à respecter dans les prompts)

- **Ne jamais laisser le perso devenir une silhouette toute noire.** Toujours
  écrire « NOT pure black, keep it readable, keep strong contrast, do not turn
  into a flat black silhouette ».
- Garder le **visage bien visible** et une amorce de couleur (rouge/or) à chaque
  étape.
- Monter l'équipement/les flammes **progressivement**.
- Les effets d'énergie (embers, flammes, veines) sont **des pixels solides du
  perso**, pas un halo — d'où « no aura, no glow » gardé dans chaque prompt.

## Bloc « style + technique » (commun à tous les niveaux)

```text
Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

## Vue d'ensemble

| Niv | Idée directrice (thème rouge/or, feu & sang) |
|---|---|
| 1 | ado ordinaire, hoodie bleu, yeux bleus (générique, aucun souci IP) |
| 2 | veste charbon + 1ère touche **cramoisi**, une dague |
| 3 | manteau noir long + liseré rouge net + amorce **or**, deux dagues |
| 4 | manteau à accents **rouges** marqués + or, ceinture rouge, dagues courbes |
| 5 | armure légère noire à **liserés or**, accents rouges, yeux ambre naissants |
| 6 | armure noir & or, premières **braises/veines cramoisi**, lame à tranchant de braise |
| 7 | armure plus lourde, **flammes rouges** aux épaules, veines d'énergie, yeux ardents |
| 8 | seigneur de sang : armure noir & or ornée, cape cramoisie, flammes autour des bras/lame |
| 9 | quasi-souverain : énergie cramoisie en fusion, reflets d'or, cape à bords de braise |
| 10 | **souverain de flammes** : armure noir & or, couronne, **ailes de FLAMMES rouges** (pas d'ombre noire), grande épée de feu, yeux or-rouge |

## Prompts par niveau

### Niveau 1 — l'ado ordinaire (hoodie bleu)

```text
Chibi pixel art character sprite, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. A cheerful young teenage boy, ordinary student: messy short dark hair, large expressive blue eyes, friendly and determined expression, blue hoodie with an orange inner collar, simple backpack straps over the shoulders. No weapon, no armor, no powers — a beginner with relaxed hands. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 2 — premier pas sombre (veste charbon)

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, slightly more confident expression. Early evolution: he now wears a dark charcoal-grey hooded jacket (NOT pure black — keep it readable with visible folds and highlights) with a single small crimson-red accent on the collar. One small basic metal dagger held downward in one hand, simple fingerless gloves. Still an early beginner, no armor, no magic, no powers. Keep strong contrast so the face and details stay clearly readable, do not turn the character into a black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 3 — le manteau noir long

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, confident determined expression. Evolution: he now wears a LONG dark coat reaching down to his knees, open at the front, dark grey-black (NOT pure black — keep folds, highlights and edges readable), with a clear crimson-red trim and a first thin gold accent. Two small metal daggers, one held in each hand pointing downward. Fingerless gloves, dark boots. A rogue look. Still no armor, no magic, no glow. Keep strong contrast so the face and the coat details stay clearly readable, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 4 — le manteau aux accents rouges

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, harder colder determined stare. Evolution: he keeps the LONG knee-length open coat, now dark grey-black with MORE pronounced deep crimson-red accents along the edges, collar and cuffs, plus thin gold trim (NOT pure black — keep folds, highlights and edges readable). Two matching curved metal daggers, one in each hand pointing downward, slightly larger and sharper. Fingerless gloves, dark leather boots, a red sash at the waist. A skilled rogue-assassin look. Still no heavy armor, no magic, no glow. Keep strong contrast so the face and the coat details stay clearly readable, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 5 — l'armure légère à liserés or

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, confident cold expression, eyes with a faint warm amber glow. Evolution: under the long dark coat he now wears LIGHT black plated armor on the chest and shoulders, with thin GOLD trim lines edging the armor and collar, and the crimson-red accents kept from before (NOT pure black — keep plates, folds and highlights readable). One dark short sword with a faint ember-red edge at his side, plus a dagger. Dark gloves and armored boots. An elite dark knight look. Light armor only, no magic yet, no glowing halo around the body. Keep strong contrast so the face, the gold trim and the armor plates stay clearly readable, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 6 — armure noir & or, premières braises

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, burning amber eyes. Evolution: black-and-gold plated armor with ornate gold trim, and the FIRST crimson-red energy cracks and small embers glowing along the arms and chest — painted as solid crisp pixels that are part of his body, not a light halo. A dark sword with a glowing ember-red edge. A warrior of flame. Keep the deep-red and gold readable. Effects on the body only, no background glow. Keep strong contrast, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 7 — flammes rouges aux épaules

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, glowing amber-red eyes. Evolution: heavier black-and-gold armor, small solid-pixel crimson flames and embers rising from the shoulders and gauntlets (part of the character, not a halo), bright crimson energy veins running along the armor, and a burning ember-edged blade. An ascending flame knight. Keep gold trim and red flames crisp and readable. Effects on the body only, no background halo. Keep strong contrast, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 8 — seigneur de sang

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, glowing red-gold eyes, commanding expression. Evolution: a blood-flame lord — ornate black armor with rich gold filigree, a tattered crimson cape, crimson fire wreathing his arms and his large burning greatsword (solid pixel flames that are part of the character). Imposing stance. Keep gold and crimson crisp and readable. Effects on the body only, no separate background halo. Keep strong contrast, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 9 — quasi-souverain

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, intense burning red-gold eyes. Evolution: majestic black-and-gold armor, molten crimson energy and gold-flame highlights across the body, a flowing crimson cape with glowing ember edges, and a great sword of fire held confidently. Powerful, near-sovereign stance. Effects are solid crisp pixels on the body only, no separate background halo. Keep strong contrast, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 10 — le souverain de flammes

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, blazing gold-red eyes. Final form — the EMBER SOVEREIGN at the peak of his power: regal black armor covered in glowing gold filigree, a golden crown or crest, great WINGS made of CRIMSON FLAME and floating embers (bright fire wings, NOT black shadow wings), a massive greatsword of molten fire, and a long crimson cape. Majestic and heroic. All flames and effects are solid crisp pixels that are part of the character (the outer halo is added later in code). Effects on the body only, no separate background glow. Keep strong contrast so the face, the gold and the crimson flames stay clearly readable, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

## Intégrer un niveau dans l'app (côté dev / assistant)

PixelLab exporte selon deux formats — les deux sont gérés :

1. L'utilisateur enregistre l'export de rotations dans `assets/hero/`.
2. Extraire les 8 frames (recadrées uniformément + agrandies ×4, net) :
   ```bash
   # a) export GIF (ex. niveau3.gif)
   node tools/extract-rotations.js "assets/hero/niveau3.gif" "assets/hero/rot3"
   # b) export ZIP -> dossier rotations/ de 8 PNG (south.png, east.png, ...)
   node tools/assemble-rotations.js "<dossier>/rotations" "assets/hero/rot4"
   ```
3. Dans `App.js` : `ROT_NIVEAU_N` (les 8 `require` de `rotN/`) ajouté à `ROT_SETS`.
   Le mapping niveau → étape passe par `etapePersonnage()` / `rotationsPourEtape()`.
4. Vérifier au bundle (`npx expo export --platform ios`).

Refaire un niveau en HQ = régénérer l'export et **écraser** le dossier `rotN/`
correspondant (le code ne change pas).

Les paliers (quand chaque étape se débloque) sont dans `jeu.js` (`PALIERS_PERSO`).
Le halo d'aura ajouté en code sera **rouge/orange** (thème feu), pas violet.
