# Avatar du héros — prompts & workflow

Ce fichier permet de **reprendre la création des personnages depuis n'importe
quel appareil**. Il contient les prompts déjà utilisés, la progression prévue,
et la marche à suivre pour intégrer un nouveau niveau.

## Concept

Un seul personnage qui **évolue sur 10 niveaux** : d'un ado ordinaire (niveau 1)
jusqu'à un **monarque des ombres** (niveau 10). Style **chibi pixel art 16-bit**
(inspiration : icône du jeu *Slayer Legend*).

- **Palette / arc choisi** : narratif (option B). Le niveau 1 est ordinaire
  (bleu), et il vire progressivement au **noir / violet / rouge / or** en montant.
- **Pas d'aura ni de glow dans le sprite** : le halo violet est ajouté **en code**
  dans l'app et s'intensifie avec le niveau.
- **Cohérence** : toujours « same face and hair as before » (même visage, mêmes
  cheveux). Sur PixelLab, chaque niveau = un **state** du même personnage.

## Outil recommandé

**PixelLab.ai** — génère des sprites de perso cohérents, avec **fond transparent**
et **rotations 8 directions**. Un *state* par niveau. Alternatives : Retro
Diffusion, Midjourney (`--cref`).

Réglages à garder identiques à chaque niveau : **fond transparent**, même taille,
**pas d'aura/glow**, vue de face, personnage centré.

## Leçons apprises (à respecter dans les prompts)

- **Ne jamais laisser le perso devenir une silhouette toute noire.** Toujours
  écrire « NOT pure black, keep it readable, keep strong contrast, do not turn
  into a flat black silhouette » — sinon le visage disparaît.
- Garder le **visage bien visible** et une **amorce de couleur** (violet/rouge)
  à chaque étape.
- Faire monter la noirceur/l'équipement **progressivement** : si on assombrit
  trop tôt, il ne reste plus rien pour les niveaux 7-10.

## Bloc « style + technique » (commun à tous les niveaux)

```text
Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

## Prompts par niveau

### Niveau 1 — l'ado ordinaire ✅ (fait)

```text
Chibi pixel art character sprite, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. A cheerful young teenage boy, ordinary student: messy short dark hair, large expressive violet-blue eyes, friendly and determined expression, blue hoodie with an orange inner collar, simple backpack straps over the shoulders. No weapon, no armor, no powers — a beginner with relaxed hands. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 2 — premier pas sombre (veste charbon) ✅ (fait)

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, slightly more confident expression. Early evolution: he now wears a dark charcoal-grey hooded jacket (NOT pure black — keep it readable with visible folds and highlights) with a single small violet accent on the collar. One small basic metal dagger held downward in one hand, simple fingerless gloves. Still an early beginner, no armor, no magic, no powers. Keep strong contrast so the face and details stay clearly readable, do not turn the character into a black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 3 — le manteau noir long

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, confident determined expression. Evolution: he now wears a LONG dark coat reaching down to his knees, open at the front, dark grey-black (NOT pure black — keep folds, highlights and edges readable), with subtle violet trim and a small red accent. Two small metal daggers, one held in each hand pointing downward. Fingerless gloves, light dark boots. A rogue assassin look. Still no armor, no magic, no glow. Keep strong contrast so the face and the coat's details stay clearly readable, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveaux 4 à 10 — vue d'ensemble

| Niv | Idée directrice |
|---|---|
| 4 | manteau long + **accents rouges** marqués, double dague, regard plus dur ✅ |
| 5 | **armure légère noire** sous le manteau, premiers **liserés or**, yeux violets qui s'allument |
| 6 | armure sombre + or, épée sombre, premières **veines d'énergie violette** sur le corps |
| 7 | armure plus lourde, **ombres qui montent** des épaules, énergie violette nette |
| 8 | seigneur d'ombre : armure noir & or, **tendrils d'ombre**, arme plus grande |
| 9 | quasi-monarque : cape/tendrils, yeux violets intenses, posture imposante |
| 10 | **monarque des ombres** : armure noir & or, **ailes/tendrils d'ombre**, épée d'énergie |

Règle : chaque niveau reste **lisible** et n'ajoute qu'un cran. Garder « same
face and hair », effets **sur le corps** uniquement (le halo est ajouté en code).
Les effets d'énergie/ombre (veines, tendrils, ailes) sont peints en **pixels
nets et solides** faisant partie du perso — **pas** un halo lumineux (qui, lui,
est ajouté en code). D'où le « no aura, no glow » gardé dans chaque prompt.

### Niveau 4 — le manteau aux accents rouges

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, harder colder determined stare. Evolution: he keeps the LONG knee-length open coat, now dark grey-black with MORE pronounced deep-red accents along the edges, collar and cuffs, plus a thin violet trim (NOT pure black — keep folds, highlights and edges readable). Two matching curved metal daggers, one in each hand pointing downward, slightly larger and sharper than before. Fingerless gloves, dark leather boots, a red sash at the waist. A skilled rogue assassin look. Still no heavy armor, no magic, no glow. Keep strong contrast so the face and the coat's details stay clearly readable, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 5 — l'armure légère à liserés or

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, confident cold expression, eyes now a brighter violet. Evolution: under the long dark coat he now wears LIGHT black plated armor on the chest and shoulders, with the FIRST thin gold trim lines edging the armor and collar, and the deep-red accents kept from before (NOT pure black — keep plates, folds and highlights readable). One dark short sword at his side plus a dagger. Dark gloves and armored boots. An elite dark rogue-knight look. Light armor only, no magic yet, no glow around the body. Keep strong contrast so the face, the gold trim and the armor plates stay clearly readable, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 6 — armure noir & or, premières veines violettes

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, intense violet eyes, stern powerful expression. Evolution: he wears darker plated armor with clear GOLD trim on the chest, shoulders and gauntlets, red accents, over the long coat (NOT pure black — keep plates, gold edges and highlights readable). He holds a larger dark sword with a faint violet-tinted blade, pointing downward. The FIRST thin violet energy veins appear as crisp painted pixel lines running along the arms and chest plates (solid readable pixels, NOT a glowing aura). Dark gold-trimmed boots and gauntlets. A dark knight-lord look. Keep strong contrast so the face, the gold and the violet veins stay clearly readable, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 7 — ombres montantes, énergie violette nette

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, fierce commanding expression, bright violet eyes. Evolution: heavier black-and-gold plated armor covering chest, shoulders and arms, with bold gold trim and red accents (NOT pure black — keep plates, gold and highlights readable). Sharp dark shadow shapes rise like crisp pixel flames from his shoulders and back (solid dark readable pixels, part of the character, NOT a background aura). Clear violet energy veins run across the armor and arms as crisp painted pixels. He wields a large dark violet-edged sword pointing downward. A rising shadow-knight look. Keep strong contrast so the face, the gold trim, the shoulder shadows and the violet veins stay clearly readable, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 8 — le seigneur d'ombre

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, cold imposing lordly expression, intense violet eyes. Evolution: ornate black-and-gold heavy armor with rich gold engraving and deep-red accents, a short torn dark cape on the shoulders (NOT pure black — keep plates, gold, cape folds and highlights readable). Several dark shadow tendrils curl outward from his back and shoulders as crisp deliberate pixel shapes (solid dark readable pixels, part of the character design, NOT a glowing background aura). Violet energy veins across the armor. He holds a large ornate dark greatsword with a violet-tinted edge. A true shadow-lord look. Keep strong contrast so the face, the gold engraving, the cape and the tendrils stay clearly readable, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 9 — le quasi-monarque

```text
Same young character as before, same face and messy dark hair, clearly visible face with good contrast, proud fearsome near-royal expression, intense violet eyes. Evolution: majestic black-and-gold armor with elaborate gold filigree, deep-red accents and a long flowing dark cape (NOT pure black — keep plates, gold filigree, cape folds and highlights readable). Multiple dark shadow tendrils spread wide from his back as crisp pixel shapes (solid dark readable pixels, part of the character, NOT a background aura). Bold violet energy veins run across the armor. He wields a large ornate dark greatsword edged with crisp violet energy pixels. An imposing commanding pose, almost a monarch. Keep strong contrast so the face, the gold filigree, the cape and the tendrils stay clearly readable, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

### Niveau 10 — le monarque des ombres (forme finale)

```text
Same young character as before, same face and messy dark hair, clearly visible face with strong contrast, supreme regal fearsome expression, blazing violet eyes. Final form, the Shadow Monarch: magnificent ornate black-and-gold royal armor with intricate gold engraving, deep-red accents, a tall dark collar and a long royal cape (NOT pure black — keep every plate, gold detail, cape fold and highlight clearly readable). Large sweeping wings made of crisp dark shadow tendrils spread from his back (solid dark deliberate pixels, part of the character design, NOT a glowing background aura). Bold violet energy veins cover the armor. He raises a huge ornate sword formed of crisp violet energy pixels. A towering, godlike, imposing monarch pose. Keep strong contrast so the face, the gold engraving, the wings and the cape stay clearly readable, do not turn him into a flat black silhouette. Chibi pixel art, 16-bit RPG style, big head and small body, bold clean black outline, crisp deliberate pixel shading. Full body, facing forward, static neutral pose, centered, transparent background, no background effects, no aura, no glow. Single character only.
```

## Intégrer un niveau dans l'app (côté dev / assistant)

1. L'utilisateur enregistre le **GIF de rotations** dans `assets/hero/` (nom
   distinct par niveau, ex. `niveau3.gif`).
2. Extraire les 8 frames, recadrées + agrandies ×4 (net) :
   ```bash
   node tools/extract-rotations.js "assets/hero/niveau3.gif" "assets/hero/rot3"   # export GIF
   node tools/assemble-rotations.js "<dossier>/rotations" "assets/hero/rot4"        # export ZIP (8 PNG south/east/...)
   ```
3. Dans `App.js` : ajouter `ROT_NIVEAU_3` (les 8 `require` de `rot3/`) et
   l'ajouter à `ROT_SETS`. Le mapping niveau → étape se fait déjà via
   `etapePersonnage()` / `rotationsPourEtape()` (voir `jeu.js`).
4. Vérifier au bundle (`npx expo export --platform ios`).

Les paliers de niveau (quand chaque étape se débloque) sont dans `jeu.js`
(`PALIERS_PERSO`).
