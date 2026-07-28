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

### Niveaux 4 à 10 — progression prévue (à détailler au moment venu)

| Niv | Idée directrice |
|---|---|
| 4 | manteau long + **accents rouges** marqués, double dague, regard plus dur |
| 5 | **armure légère noire** sous le manteau, premiers **liserés or**, yeux violets qui s'allument |
| 6 | armure sombre + or, épée sombre, premières **veines d'énergie violette** sur le corps |
| 7 | armure plus lourde, **ombres qui montent** des épaules, énergie violette nette |
| 8 | seigneur d'ombre : armure noir & or, **tendrils d'ombre**, arme plus grande |
| 9 | quasi-monarque : cape/tendrils, yeux violets intenses, posture imposante |
| 10 | **monarque des ombres** : armure noir & or, **ailes/tendrils d'ombre**, épée d'énergie |

Règle : chaque niveau reste **lisible** et n'ajoute qu'un cran. Garder « same
face and hair », effets **sur le corps** uniquement (le halo est ajouté en code).

## Intégrer un niveau dans l'app (côté dev / assistant)

1. L'utilisateur enregistre le **GIF de rotations** dans `assets/hero/` (nom
   distinct par niveau, ex. `niveau3.gif`).
2. Extraire les 8 frames, recadrées + agrandies ×4 (net) :
   ```bash
   node tools/extract-rotations.js "assets/hero/niveau3.gif" "assets/hero/rot3"
   ```
3. Dans `App.js` : ajouter `ROT_NIVEAU_3` (les 8 `require` de `rot3/`) et
   l'ajouter à `ROT_SETS`. Le mapping niveau → étape se fait déjà via
   `etapePersonnage()` / `rotationsPourEtape()` (voir `jeu.js`).
4. Vérifier au bundle (`npx expo export --platform ios`).

Les paliers de niveau (quand chaque étape se débloque) sont dans `jeu.js`
(`PALIERS_PERSO`).
