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
visage d'un état à l'autre. **Seuls les yeux changent de couleur** : c'est
pourquoi chaque prompt redonne leur couleur.

### Acte I — l'Éveil

**H1 — L'inconnu**
```text
A young man in his twenties, ordinary and a bit tired but determined look, messy brown hair, normal brown eyes. Plain dark grey hoodie, dark jeans, worn sneakers, hands empty. Slim build, slightly hunched posture. No weapon, no armor, no effects.
```

**H2 — L'ombre qui bouge**
```text
Same character, same face and same messy brown hair, normal brown eyes. Same dark grey hoodie and jeans, now with black fingerless gloves and a cheap short knife on the belt. Standing a little straighter. His shadow on the ground is slightly too dark and a small black wisp rises from it.
```

**H3 — L'éveil**
```text
Same character, same face and same messy brown hair, brown eyes with a faint green glint. Dark grey hoodie, black cargo pants, combat boots, fingerless gloves. Holds a short steel dagger. A small pool of living black shadow at his feet, one tiny green ghost-fire wisp floating near his hand.
```

**H4 — Le blouson**
```text
Same character, same face and same messy brown hair, brown eyes with a green glint. Black bomber jacket over the hoodie, cargo pants, combat boots, short dagger. Slightly broader shoulders, confident stance. Black shadow pool at his feet, two small green ghost-fire wisps floating around him.
```

**H5 — Premier appel**
```text
Same character, same face and same messy brown hair, brown eyes with a green glint. Black hooded jacket with torn edges, cargo pants, combat boots, a short dagger in each hand held backwards. Athletic build. A tiny floating spectral skull with green glowing eye sockets hovers beside him. Black shadow pool at his feet.
```

### Acte II — l'Adepte des ombres

**H6 — Le long manteau**
```text
Same character, same face and same messy brown hair, hazel-green eyes with a faint glow. Knee-length black coat with bone-white buckles, black pants, boots, one curved dagger. Athletic build. Black shadow tendrils curl around his boots, one small floating spectral skull with green eyes.
```

**H7 — Le harnais d'os**
```text
Same character, same face and same messy brown hair, glowing hazel-green eyes. Long black coat open over a dark leather harness decorated with small bone ornaments, bone-white bracers, two curved daggers. Stronger, more muscular build. Shadow tendrils at his feet, green ghost-fire wisps float around the blades.
```

**H8 — Les mains de l'ombre**
```text
Same character, same face and same messy brown hair, glowing hazel-green eyes. Long black coat with high collar, bone-decorated harness, bone-white bracers, two curved daggers. Two small spectral skeletal hands made of shadow and green light rise from the black pool at his feet.
```

**H9 — L'épaulière crâne**
```text
Same character, same face and same messy brown hair, glowing emerald green eyes. Long black coat with high collar, one dark armored shoulder pad shaped like a skull, bone-white bracers, two daggers with blades dripping green ghost-fire. Spectral skeletal hands rise from the shadow pool at his feet.
```

**H10 — Le capuchon**
```text
Same character, same face and same messy brown hair visible under a raised black hood, bright glowing emerald eyes in the shadow of the hood. Black coat over light dark-metal chest armor, skull shoulder pad, two ghost-fire daggers. Strong build. Three small spectral skulls with green eyes orbit around him.
```

### Acte III — le Nécromancien

**H11 — La faux**
```text
Same character, same face and same messy brown hair, hood down, glowing emerald eyes, a small scar on the cheek. Dark metal and bone light armor, both shoulders armored, heavy boots. He now wields a black scythe with a curved blade glowing with green ghost-fire. Powerful build. Spectral skulls orbit around him.
```

**H12 — La cape déchirée**
```text
Same character, same face and same messy brown hair, glowing emerald eyes, small scar. Dark metal and bone armor, a tattered black cape whose bottom dissolves into shadow smoke, glowing green veins along his forearms, black scythe with ghost-fire blade. Spectral skulls orbit around him.
```

**H13 — Les gantelets**
```text
Same character, same face and same messy brown hair, glowing emerald eyes, small scar. Dark armor with bone details, clawed black gauntlets, tattered shadow cape, green veins on the arms. Black scythe wreathed in green ghost-fire. Spectral skeletal hands rise from the shadow pool, spectral skulls float around him.
```

**H14 — Les flammes spectrales**
```text
Same character, same face and same messy brown hair, blazing emerald eyes with thin green wisps at the corners, small scar. Heavier dark armor with bone details, clawed gauntlets, shadow cape. Green ghost-fire burns on both shoulder pads. Black scythe with ghost-fire blade. Spectral skulls orbit around him.
```

**H15 — Le seigneur des tombes**
```text
Same character, same face and same messy brown hair, blazing emerald eyes with green wisps, small scar. Full dark armor with bone ornaments and glowing green runes, long shadow cape, ghost-fire on the shoulders, large black scythe. Imposing, powerful build. A ring of floating green-eyed spectral skulls behind his back.
```

### Acte IV — le Souverain des Tombes

**H16 — L'armure gravée**
```text
Same character, same face and same messy brown hair, blazing emerald eyes with green wisps, small scar. Ornate dark armor engraved with bone-white patterns and glowing green runes, long shadow cape, ghost-fire on the shoulders, large black scythe. A ring of spectral skulls floats behind him.
```

**H17 — La mèche blanche**
```text
Same character, same face, messy brown hair now with a bone-white streak, blazing emerald eyes with green wisps, small scar. Ornate engraved dark armor, long shadow cape, ghost-fire on the shoulders, large black scythe. Shadow smoke rises around him, a ring of spectral skulls floats behind him.
```

**H18 — La faux des âmes**
```text
Same character, same face, brown hair with a bone-white streak, blazing emerald eyes with green wisps, small scar. Ornate dark armor, long shadow cape. Wields a huge scythe whose blade is made of solid green ghost-fire. A circle of floating green necromantic runes surrounds him, spectral skeletal hands rise from the shadows at his feet.
```

**H19 — La couronne d'os**
```text
Same character, same face, brown hair with a bone-white streak, incandescent emerald eyes with white-hot core, small scar. Ornate dark armor with bone and dark gold engravings, shadow cape with a torn edge of green ghost-fire, huge ghost-fire scythe. A thin crown of bone on his head. Floating runes and spectral skulls around him.
```

**H20 — Le Souverain des Tombes**
```text
Same character, same face, brown hair with a bone-white streak, incandescent emerald eyes with white-hot core, small scar. Majestic dark armor with bone and dark gold engravings, a crown of bone wreathed in green ghost-fire. Huge wings made of black shadow smoke and green ghost-fire behind his back, a massive ghost-fire scythe. Spectral skulls and skeletal hands rise from a vast shadow pool at his feet. Regal, terrifying presence.
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

- [ ] Recevoir la **photo du chat** → remplacer `{CHAT}` dans les prompts C1-C20
- [ ] Générer H1 + C1 et les tester dans l'app
- [ ] Code : choix du perso à l'onboarding (persisté dans `stockage.js`, non modifiable ensuite)
- [ ] Code : `PALIERS_PERSO` (20 étapes) dans `jeu.js`, composant d'affichage
      (rotation + animations + réactions) dans `App.js`
