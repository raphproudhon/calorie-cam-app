# Branche `experimentation/sans-perso`

> **Ne pas fusionner dans `main`.** Cette branche est un bac à sable : `main`
> doit rester tel quel tant que le nouveau système de personnage n'est pas
> décidé.

## À quoi sert cette branche

Le système de personnage évolutif (l'avatar pixel art qui changeait de forme au
fil des niveaux) **a été entièrement retiré ici**, pour repartir de zéro sur une
autre base. Cette branche est l'état « CalorieCam sans personnage » : une app
qui marche, sur laquelle on peut construire le prochain système.

Elle ne remplace pas `main`, elle propose une alternative. Rien n'y est
définitif.

## Repères Git

| | |
|---|---|
| Branche | `experimentation/sans-perso` |
| Partie de | `main`, commit `cb40e35` |
| Contient | un seul commit : `998a18a` |
| Pull request | #1, **fermée sans fusion** le 22/09/2026 |
| `main` | intact sur `cb40e35`, le personnage y est toujours |

Une ancienne étiquette, `claude/resync-device-github-i8057m`, pointe encore sur
le même commit `998a18a` sur GitHub : c'est le nom d'origine de cette branche,
qui n'a pas pu être supprimé depuis la session où le renommage a été fait.
Elle ne sert à rien et peut être effacée depuis la page *branches* du dépôt.

## Ce qui a été retiré

| Quoi | Détail |
|---|---|
| `assets/hero/` | 53 fichiers : 4 GIF sources PixelLab, le dossier `niveau4-src/` (export 8 PNG + son `metadata.json`), et les 5 jeux d'angles `rot/`, `rot2/` … `rot5/` à 8 PNG chacun |
| `tools/` | `analyse-sheet.js`, `slice-hero.js`, `remove-bg.js`, `key-green.js`, `assemble-rotations.js`, `extract-rotations.js`, `sprite-studio.html`. Il ne reste que `build-ciqual.js` |
| `sprites.js` | lecteur de sprites pixel — il n'était déjà plus importé nulle part |
| `AVATAR.md` | concept, prompts PixelLab des 10 niveaux, workflow d'intégration |
| `jeu.js` | `PALIERS_PERSO`, `NB_ETAPES`, `NOMS_ETAPES`, `etapePersonnage()` |
| `App.js` | `ROT_NIVEAU_1..5`, `ROT_SETS`, `rotationsPourEtape()`, `AvatarRotatif`, l'avatar et le nom d'étape de la carte de progression, le compteur « étape N/10 » de la section de test, les imports `Image` et `PanResponder`, et trois styles orphelins |

Total : 66 fichiers touchés, +61 / −1 121 lignes.

## Ce qui a été gardé

L'XP, les niveaux, les badges et la série sont intacts. La carte de l'onglet
Progression garde sa barre d'XP, sa série et ses badges — elle perd seulement le
personnage.

### Le seul changement de comportement : le thème

C'était le point délicat. L'accent et la couleur de fond de **toute l'app**
dérivaient de l'étape du personnage. Ils dérivent désormais du **niveau** :

- `accentPourEtape()` → `accentPourNiveau()`
- `fondPourEtape()` → `fondPourNiveau()`
- nouveau : `paletteDepuisNiveau()`, qui donne l'index de palette (0-9)

La rampe de dix couleurs (bleu → cramoisi → or) et ses dix paliers
(`PALIERS_COULEUR = [1, 2, 4, 6, 9, 13, 18, 24, 31, 40]`) sont repris tels
quels. **À niveau égal, l'app a exactement la même apparence qu'avant** : seule
la source du calcul a changé.

## Reprendre depuis un autre appareil

L'installation du projet (Node, clé Gemini dans `secrets.js`, `npx expo start`)
est décrite dans le `README.md` — elle ne change pas ici. Une fois le dépôt
cloné, il suffit de se placer sur la branche :

```bash
git fetch origin
git checkout experimentation/sans-perso
npm install
npx expo start
```

⚠️ Rappel du `README.md` : **ne pas cloner dans OneDrive** — la synchronisation
casse `.git` et duplique `secrets.js` avec la vraie clé dedans.

## Récupérer l'ancien système de personnage

Rien n'est perdu : tout est dans l'historique, sur `main` et dans le commit
parent `cb40e35`. Pour remettre les fichiers dans l'arbre de travail :

```bash
git checkout cb40e35 -- assets/hero sprites.js AVATAR.md tools/
```

(commande vérifiée : elle restitue bien les 53 fichiers de `assets/hero`, les 7
outils, `sprites.js` et `AVATAR.md`). Le code qui les utilisait, lui, est à reprendre à la main dans
`App.js` et `jeu.js` — ou plus simplement en lisant `git show 998a18a` à
l'envers.

Pour juste **consulter** un fichier sans le restaurer :

```bash
git show cb40e35:AVATAR.md
```

## À savoir avant de continuer

- **Le bundle Metro n'a jamais été lancé sur ce code.** Les vérifications faites
  sont statiques : `node --check` sur les 12 modules, zéro `require` d'asset
  manquant, et les 7 symboles importés de `jeu.js` existent bien. Un
  `npx expo start` reste à faire pour confirmer que l'onglet Progression
  s'affiche correctement sans l'avatar.
- **`gifwrap` et `jimp` sont restés dans `devDependencies`** alors que plus
  aucun code ne les utilise. Ils ont été laissés exprès : le prochain système de
  personnage en aura probablement besoin. À retirer si on part sur autre chose.
- Le workflow `.github/workflows/pages.yml` ne se déclenche que sur un push vers
  `main`. **Tant qu'il n'y a pas de fusion, le site en ligne n'est pas touché**
  et garde le personnage.

## Ce qui reste à décider

Le nouveau système de personnage est entièrement ouvert. Les questions laissées
en suspens :

- quelle forme prend le personnage (sprite ? illustration ? autre chose ?) ;
- comment il se met à jour (rotation au doigt, animation, image fixe) ;
- combien d'étapes, et sur quels paliers de niveau ;
- si le thème de couleurs doit y être raccroché de nouveau, ou rester piloté par
  le niveau comme aujourd'hui.

### Deux leçons de l'ancien système, à ne pas réapprendre

1. **Tout ce qui flotte autour du personnage le fait rétrécir.** L'outil
   d'extraction recadrait les 8 angles sur la boîte englobant les pixels
   visibles de *toutes* les frames. Un halo, de la fumée ou des particules
   élargissaient cette boîte, donc réduisaient le personnage à l'écran.
2. **Ce qui compte n'est pas la taille du canevas, mais la part qu'y occupe le
   personnage.** `niveau1.gif` était en 128×128 avec le perso sur 118 px (92 %),
   les autres en 120×120 avec le perso sur 60 px (50 %) : d'où un personnage qui
   rapetissait en montant en niveau, jusqu'à ce que la boîte d'affichage soit
   passée en carré (commit `cb40e35` sur `main`).
