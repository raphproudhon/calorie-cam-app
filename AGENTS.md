# Contexte pour un assistant IA

Ce projet (**CalorieCam**) est décrit en détail dans le `README.md` — le lire en premier.

⚠️ **Nouveau système de personnage : cahier des charges, prompts PixelLab et
suivi dans `PERSO.md`.** Deux persos au choix (humain / chat, choix définitif
après l'onboarding), 20 étapes chacun, rotation 8 directions au doigt. Après
avoir changé un GIF de `assets/perso/`, relancer `node tools/build-perso.js`. L'ancien système a été entièrement retiré (art, outils
sprites, étapes, avatar rotatif). Il est à reprendre de zéro ; l'ancienne
version reste consultable dans l'historique Git, avant le commit de suppression.
Le pourquoi, l'inventaire de ce qui a sauté et la marche à suivre pour reprendre
sont dans **`EXPERIMENTATION.md`** — à lire avant de toucher à cette branche.
Le thème de couleurs de l'app, qui suivait l'étape du personnage, suit
désormais directement le **niveau** (`accentPourNiveau` / `fondPourNiveau`).

Points clés :

- **Expo SDK 54** (imposé par la version d'Expo Go du téléphone de test). Ne pas
  mettre à jour vers un SDK plus récent sans vérifier ce que supporte l'Expo Go
  installé. Docs de la bonne version : https://docs.expo.dev/versions/v54.0.0/
- IA vision : **Google Gemini**, modèle `gemini-flash-latest`. Le code appelle
  l'API REST directement (`fetch`) dans `gemini.js`.
- La clé API est dans `secrets.js` (exclu de Git). Ne jamais la commiter, ne
  jamais la remettre en clair dans le code. `cle.js` la résout à l'exécution :
  clé saisie dans les Paramètres (persistée localement) sinon clé de
  `secrets.js`. La version web publiée sur GitHub Pages n'embarque AUCUNE clé.

## Règle d'architecture à ne pas casser

**L'IA n'invente aucune valeur nutritionnelle.** Elle identifie les aliments et
estime les masses ; les calories et macros viennent exclusivement de la table
Ciqual de l'ANSES (`data/ciqual.json`). Si une évolution redonne à l'IA le
calcul des calories, c'est une régression : c'est précisément le défaut que
cette version corrige.

Corollaire : l'état de cuisson compte autant que l'aliment. Le riz cru est à
350 kcal/100 g, cuit à 145 — confondre les deux fausse le résultat d'un facteur
2,4. Le scoring de `ciqual.js` et le prompt de la passe 2 traitent ce cas
explicitement.

## Structure de l'app

Trois onglets — **Photo** (analyse d'un plat par photo **ou scan de
code-barres**), **Progression** (niveau/XP/badges + courbe de poids + calories),
**Bilan** (calories restantes du jour). Onboarding obligatoire au 1er lancement ;
objectif réglable ensuite via la **roue crantée** (menu Paramètres, haut gauche).
Tout est persisté localement (`stockage.js`).

Le scan de code-barres (`expo-camera`) interroge **Open Food Facts** et empile
plusieurs produits dans une même analyse (avec anti-doublon) ; les produits
passent dans le même affichage/bilan que les aliments d'une photo.

## Fichiers

| Fichier | Rôle |
|---|---|
| `App.js` | les 3 onglets, l'onboarding, les paramètres |
| `gemini.js` | passe 1 (vision) et passe 2 (choix de la fiche Ciqual) |
| `ciqual.js` | recherche floue dans la table + calcul nutritionnel |
| `off.js` | scan de code-barres → produit **Open Food Facts** mis à la forme d'une fiche (compatible `calculer()`) |
| `besoins.js` | BMR/objectif calorique + bilan du jour, garde-fous de sécurité |
| `health.js` | lecture de la dépense via Apple Santé (HealthKit) |
| `stockage.js` | persistance locale (AsyncStorage) + bascule de journée à minuit |
| `jeu.js` | gamification : XP, niveaux, badges, étapes du perso (`PALIERS_PERSO`, `PERSOS`, `etapePersonnage`) + palette du thème par niveau |
| `perso-sprites.js` | **généré** par `tools/build-perso.js` : table des sprites `SPRITES[perso][étape][direction]` |
| `assets/perso/` | GIF PixelLab sources (`humain/h1..20.gif`, `chat/c1..20.gif`) + PNG générés dans `rot/` |
| `tuto.js` | tutoriel du 1er lancement en « projecteur » (écran assombri sauf l'élément montré) ; les vues s'enregistrent via `ref={cible("id")}` ; `etat.tutoVu`, « Revoir le tutoriel » dans les Paramètres |
| `lien.js` | lien entrant `caloriecam://sport?kcal=N` (raccourci iOS qui lit Apple Santé quand l'app sideloadée n'a pas HealthKit) → remplace le sport du jour |
| `version.js` | numéro de version affiché dans les Paramètres (`local` ; réécrit par le workflow Expo Go) |
| `cle.js` | résolution de la clé API Gemini (saisie dans l'app ou `secrets.js`) |
| `data/ciqual.json` | table réduite (235 Ko), **versionnée** — ne pas régénérer sans raison |
| `tools/` | outils hors-app : `build-ciqual.js` (conversion de la table ANSES), `build-perso.js` (GIF PixelLab → sprites de l'app) |

## Invariants à ne pas casser

- **`health.js` doit toujours se dégrader proprement dans Expo Go.** HealthKit
  est natif et absent d'Expo Go : le module natif est chargé en *lazy require*
  dans un try/catch (et un garde `expo-constants` détecte Expo Go pour ne jamais
  tenter le require — NitroModules plante sinon au chargement). `estDisponible()`
  renvoie `false` si le natif manque, l'UI affiche un message au lieu de planter.
  Ne jamais transformer ce require en `import` de haut niveau.
- **`besoins.js` ne doit jamais proposer un objectif sous le plancher de
  sécurité** (1200 kcal femme / 1500 kcal homme). Et **l'activité choisie
  n'entre pas dans le calcul** : l'objectif de base = BMR × 1,2 (repos, hors
  sport) ; la dépense de sport ne vient QUE d'Apple Santé (ou saisie manuelle),
  ajoutée dans le Bilan → aucun double comptage.
- **`jeu.js` ne récompense jamais la sous-alimentation.** Le bonus « cible »
  d'une journée exige que le consommé reste dans une fourchette autour de
  l'objectif ; manger beaucoup trop peu ne donne pas d'XP « cible ». Garde-fou
  santé, testé.
- **L'IA n'invente aucune valeur nutritionnelle** (voir la règle plus haut).

## Modes d'exécution

- **Expo Go** (`npx expo start`, souvent `--tunnel` car le réseau local bloque) :
  tout marche SAUF Apple Santé.
- **Web** (`npx expo start --web`, ou touche `w`) : aperçu dans le navigateur,
  pratique pour une démo / un partage d'écran. Le scan de code-barres n'y marche
  pas (caméra web limitée) ; le reste oui. Deps : `react-native-web`, `react-dom`.
- **GitHub Pages** (`.github/workflows/pages.yml`, push sur `main`) : version web
  publique, sans clé API embarquée — chacun colle la sienne dans les Paramètres.
- **Expo Go sans PC** (`.github/workflows/expo-go.yml`, push sur la branche du
  perso) : publie la branche par EAS Update (secret `EXPO_TOKEN`), numérotée
  `perso-<n>` — le numéro s'affiche en bas des Paramètres (`version.js`, réécrit
  par le workflow, qui y active aussi la section de test).
- **.ipa non signé** (`.github/workflows/ipa.yml`, commit contenant `[ipa]`) :
  compilé sur un Mac GitHub, publié en pre-release `ipa-<n>`, installé via
  SideStore. La signature gratuite retire l'entitlement HealthKit (vérifié : il
  est bien dans l'ipa) → Apple Santé passe par un raccourci iOS et `lien.js`.
- **Build de développement** (EAS, voir README) : nécessaire pour HealthKit.
  Se lance ensuite avec `npx expo start --dev-client`.

## Pièges rencontrés

- Le XML de l'ANSES est encodé en **windows-1252**, pas en UTF-8, et contient
  des `<` **non échappés** dans certains libellés — il n'est donc pas
  strictement valide. `tools/build-ciqual.js` gère les deux cas ; ne pas le
  « simplifier » avec un parseur XML standard sans vérifier.
- ~890 aliments de la table n'ont aucune valeur énergétique : ils sont exclus
  du JSON, sinon ils polluent la recherche.
- La recherche textuelle seule trouve la bonne fiche en 1ʳᵉ position dans 84 %
  des cas seulement — d'où la passe 2. Mais elle la place dans le top 8 dans
  96 % des cas, ce qui suffit pour que le modèle tranche.
