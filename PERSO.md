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
| Inspiration | l'esprit de *Solo Leveling* (chasseur faible qui s'éveille et devient un souverain), **sans plagiat** : pas d'ombres violettes, pas d'armée d'ombres, pas de fenêtre « System » copiée |
| Effets flottants | **autorisés** (runes, étincelles, éclats…), à condition de rester dans le canevas |

## Concept

**Deux personnages totalement indépendants.** À l'onboarding, l'utilisateur
choisit **l'un ou l'autre**, et il le garde pour toute sa progression : pas
de changement possible ensuite, pas de lien entre les deux, jamais affichés
ensemble. Chacun a son propre univers, sa propre palette et ses propres
animations.

### L'humain — le Chasseur (épique / badass)

Un jeune homme ordinaire s'éveille à un pouvoir d'**énergie azur** (bleu-cyan
électrique, givre et foudre). Il gravit les rangs E → S jusqu'à devenir le
*Souverain d'Azur*.

- Ce qui rappelle *Solo Leveling* : le chasseur au bas de l'échelle, les rangs,
  les yeux qui s'allument, les dagues puis la grande lame, le manteau sombre,
  la montée en puissance jusqu'à un titre de souverain.
- Ce qui l'en distingue : l'élément **azur (givre / foudre)** au lieu des
  ombres violettes, et aucune armée d'invocations.

### Le chat — le Chat céleste (mignon / kawaii)

Un chaton ordinaire, inspiré d'un vrai chat (photo), s'éveille à une **flamme
spirituelle ambrée**. Il gagne des accessoires, puis des queues de flamme,
jusqu'à devenir un *Gardien céleste* à trois queues. Il reste rond et adorable
jusqu'au bout.

### Palettes

| Perso | Base | Accents | Fin de progression |
|---|---|---|---|
| Humain | noir charbon, gris ardoise | **cyan azur**, argent | + touches d'**or** aux étapes 19-20 |
| Chat | pelage de la photo | **ambre / or**, crème, rose pâle | flammes ambre + or, gemmes roses |

## Réglages PixelLab (communs aux deux persos)

| Réglage | Valeur |
|---|---|
| Taille du canevas | **120 × 120** |
| Vue | **low top-down** |
| Directions | **8** (pour la rotation au doigt) |
| Proportions | **chibi** |
| Contour | **contour noir fin** (single color black outline) |
| Ombrage | **aucun / aplats** (flat shading) |
| Détail | **moyen**, à passer en élevé si le résultat manque de lisibilité |
| Fond | transparent |
| Frames par animation | **8** |

Méthode : **un personnage PixelLab par perso, un état (state) par étape.**
L'étape 1 crée le personnage ; chaque étape suivante est un nouvel état créé à
partir du précédent.

### Règle de cadrage (la leçon de l'ancien système)

Avec l'ancien système, le perso rapetissait à chaque étape. La cause n'était pas
les effets, mais le recadrage automatique sur les pixels visibles. Deux règles
pour cette fois :

1. **Le code affichera toujours le canevas 120 × 120 entier, sans recadrage.**
2. **Le perso garde la même hauteur à toutes les étapes.** Chaque prompt le
   rappelle (`character fills about 70% of the canvas height`). Les effets
   flottants vont dans la marge autour, sans jamais sortir du cadre.

Si une étape sort plus petite ou plus grande que la précédente, on la régénère
plutôt que de la corriger en code.

## Bloc commun (à coller à la fin de CHAQUE prompt d'étape)

```text
Chibi proportions, big head, small body. Thin black outline, flat colors, no shading, clean readable pixel art. Low top-down view. Character centered, fills about 70% of the canvas height, same size as the previous state. Floating effects stay inside the canvas margins. Transparent background. Single character only.
```

---

## Humain — le Chasseur (épique / badass)

Hypothèse de départ, à changer si besoin : **jeune homme d'une vingtaine
d'années, cheveux noirs en bataille, yeux gris.**

Pour tous les prompts après le 1 : ils commencent par
`Same character, same face and same messy black hair.` pour garder le même
visage d'un état à l'autre.

### Acte I — l'Éveil (rang E)

**H1 — Le chasseur de rang E**
```text
A young man around 20, ordinary and a bit tired but determined look, messy black hair, grey eyes. Plain grey hoodie, dark jeans, worn sneakers, hands empty. Slim build, slightly hunched posture. No weapon, no armor, no effects.
```

**H2 — Premier signe**
```text
Same character, same face and same messy black hair. Same grey hoodie and jeans, now with black fingerless gloves and a cheap short knife on the belt. Standing a little straighter. A tiny floating translucent cyan square rune hovers near his head.
```

**H3 — L'éveil**
```text
Same character, same face and same messy black hair. Grey hoodie, dark cargo pants, black combat boots, fingerless gloves. Holds a short steel dagger in one hand. His grey eyes now have a faint cyan glow. A tiny floating cyan rune near his head.
```

**H4 — Le blouson**
```text
Same character, same face and same messy black hair, faint cyan glowing eyes. Black bomber jacket over the grey hoodie, cargo pants, combat boots, short dagger. Slightly broader shoulders, confident stance. Two or three small cyan pixel sparks floating around his hands.
```

**H5 — Rang D**
```text
Same character, same face and same messy black hair, glowing cyan eyes. Dark hooded jacket with thin glowing cyan trim lines, black cargo pants, combat boots, a short dagger in each hand held backwards. Athletic build, confident stance. A few small cyan runes and sparks float around him.
```

### Acte II — le Chasseur (rangs C et B)

**H6 — Le long manteau**
```text
Same character, same face and same messy black hair, glowing cyan eyes. Knee-length dark charcoal coat with silver buckles, black pants, boots, one curved dagger in hand, a second on the belt. Athletic build. Small cyan sparks float around him.
```

**H7 — Harnais de combat**
```text
Same character, same face and same messy black hair, glowing cyan eyes. Long charcoal coat open over a black leather chest harness, silver bracers on both forearms, two curved daggers in hand. Stronger, more muscular build. Small cyan sparks float around the blades.
```

**H8 — Le givre**
```text
Same character, same face and same messy black hair, glowing cyan eyes. Long charcoal coat with a high collar and glowing cyan seams, leather harness, silver bracers, two curved daggers. Wisps of pale cyan frost mist float around his feet.
```

**H9 — Première pièce d'armure**
```text
Same character, same face and same messy black hair, glowing cyan eyes. Long charcoal coat with high collar and cyan seams, one silver armored shoulder pad, bracers, two curved daggers with blades glowing cyan. Frost wisps float around his feet.
```

**H10 — Rang B**
```text
Same character, same face and same messy black hair visible under a raised dark hood, bright glowing cyan eyes in the shadow of the hood. Charcoal coat over a light black-and-silver chest armor, silver shoulder pad, two glowing cyan curved daggers. Strong build. Three small ice-blue crystal shards orbit around him.
```

### Acte III — l'Élite (rangs A et S)

**H11 — Rang A**
```text
Same character, same face and same messy black hair, hood down, glowing cyan eyes, a small scar on the cheek. Black-and-silver light armor, both shoulders armored, heavy boots, longer curved blades glowing cyan. Powerful build. Ice-blue crystal shards orbit around him.
```

**H12 — La cape**
```text
Same character, same face and same messy black hair, glowing cyan eyes, small scar. Black-and-silver armor, a tattered dark cape, glowing cyan energy veins running along his forearms, two long glowing cyan blades. Crystal shards orbit around him.
```

**H13 — Foudre azur**
```text
Same character, same face and same messy black hair, glowing cyan eyes, small scar. Black-and-silver armor, armored gauntlets, tattered dark cape, cyan energy veins on the arms. His two long blades crackle with small cyan lightning bolts. Crystal shards and tiny sparks float around him.
```

**H14 — Flammes de givre**
```text
Same character, same face and same messy black hair, glowing cyan eyes, small scar. Heavier black-and-silver armor, armored gauntlets, dark cape. Small pale cyan frost flames burn on both shoulder pads. Two long blades crackling with cyan lightning. Crystal shards orbit around him.
```

**H15 — Rang S**
```text
Same character, same face and same messy black hair, intense glowing cyan eyes, small scar. Full black-and-silver armor with glowing cyan lines, long dark cape with cyan inner lining, frost flames on the shoulders, one long glowing cyan sword. Imposing, powerful build. A ring of ice-blue crystal shards floats behind his back.
```

### Acte IV — le Souverain d'Azur

**H16 — L'armure gravée**
```text
Same character, same face and same messy black hair, intense glowing cyan eyes, small scar. Ornate black armor with engraved silver patterns and glowing cyan lines, long cape with cyan lining, frost flames on the shoulders, long glowing cyan sword. A ring of crystal shards floats behind him.
```

**H17 — La mèche d'argent**
```text
Same character, same face, messy black hair now with a bright silver-white streak, intense glowing cyan eyes, small scar. Ornate engraved black-and-silver armor, long cape, frost flames on the shoulders, long glowing cyan sword. Tiny cyan particles rise around him; a ring of crystal shards floats behind him.
```

**H18 — La grande lame**
```text
Same character, same face, black hair with a silver-white streak, intense glowing cyan eyes, small scar. Ornate engraved black-and-silver armor, long cape. Wields a large two-handed greatsword made of glowing ice-blue energy. A circle of floating cyan runes surrounds him.
```

**H19 — L'or apparaît**
```text
Same character, same face, black hair with a silver-white streak, intense glowing cyan eyes, small scar. Ornate black armor with silver and first gold engravings, long cape with cyan lining and gold trim, large ice-blue energy greatsword. Floating runes and a small halo of crystal shards above his head.
```

**H20 — Le Souverain d'Azur**
```text
Same character, same face, black hair with a silver-white streak, blazing cyan eyes with a gold glint, small scar. Majestic black armor with silver and gold engravings, long royal cape with cyan lining and gold trim. A crown of floating ice-blue crystal shards above his head, a pair of large spectral wings made of cyan energy behind his back, huge ice-blue energy greatsword. Regal, overwhelming presence.
```

---

## Chat — le Chat céleste (mignon / kawaii)

⚠️ **En attente de la photo du chat.** Chaque prompt contient `{CHAT}` : on le
remplacera par la description du pelage (couleur, motifs, yeux, particularités)
une fois la photo reçue. Le reste est prêt.

Pour tous les prompts après le 1 : ils commencent par
`Same cat, same fur pattern and same face.`

### Acte I — le Chaton

**C1 — Le chaton**
```text
A tiny cute kitten, {CHAT}. Huge sparkly eyes, round face, small pink nose, sitting, happy expression. No accessories, no effects. Kawaii style.
```

**C2 — Le grelot**
```text
Same cat, same fur pattern and same face. Tiny cute kitten wearing a red collar with a small golden bell. Huge sparkly eyes, happy expression. Kawaii style.
```

**C3 — L'écharpe**
```text
Same cat, same fur pattern and same face. Cute kitten, slightly bigger, wearing a small cream scarf and the collar with golden bell. Huge sparkly eyes, playful expression. A tiny amber sparkle floats next to it. Kawaii style.
```

**C4 — Première étincelle**
```text
Same cat, same fur pattern and same face. Cute young kitten with a cream scarf and golden bell collar. The tip of its tail glows with a tiny amber light. Two small amber sparkles float around it. Kawaii style.
```

**C5 — La petite cape**
```text
Same cat, same fur pattern and same face. Cute young cat wearing a tiny adventurer cape in cream and amber, golden bell collar that now glows softly. Tail tip glowing amber. A few amber sparkles float around it. Proud, adorable expression. Kawaii style.
```

### Acte II — l'Apprenti

**C6 — Le harnais**
```text
Same cat, same fur pattern and same face. Cute young cat wearing a small brown leather harness with a tiny pouch, tiny cream-and-amber cape, glowing golden bell. Tail tip glowing amber. Amber sparkles float around it. Kawaii style.
```

**C7 — La flamme de la queue**
```text
Same cat, same fur pattern and same face. Cute cat with leather harness, tiny cape, glowing golden bell. The tip of its tail now burns with a small cute amber spirit flame. Amber sparkles float around it. Kawaii style.
```

**C8 — Le plastron**
```text
Same cat, same fur pattern and same face. Cute cat wearing a tiny golden chest plate over its harness, small cape, glowing bell. Amber spirit flame at the tail tip. Amber sparkles float around it. Brave, adorable expression. Kawaii style.
```

**C9 — Les runes-pattes**
```text
Same cat, same fur pattern and same face. Cute cat with tiny golden chest plate, small cape, glowing bell, amber spirit flame at the tail tip. Small glowing amber paw-print runes float around it. Kawaii style.
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
| **level up** | montée de niveau / nouvelle étape | `power-up: raises weapon, burst of cyan energy sparks around him, returns to idle pose` | `jumps up joyfully, burst of amber sparkles and hearts, lands back in idle pose` |
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

- [ ] Recevoir la **photo du chat** → remplacer `{CHAT}` dans les prompts C1-C20
- [ ] Confirmer le look de départ de l'humain (hypothèse : jeune homme, cheveux noirs)
- [ ] Générer H1 + C1 et les tester dans l'app
- [ ] Code : choix du perso à l'onboarding (persisté dans `stockage.js`, non modifiable ensuite)
- [ ] Code : `PALIERS_PERSO` (20 étapes) dans `jeu.js`, composant d'affichage
      (rotation + animations + réactions) dans `App.js`
