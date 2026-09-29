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
désormais le **perso et le niveau** (`themePerso` dans `jeu.js`) : couleur qui suit les 20 étapes du Nécromancien d'après son design (brun → vert émeraude → or sombre), thème clair au Chat (blanc, rose pâle, vert pâle). Deux palettes dans `App.js` (`PALETTES.sombre` / `PALETTES.clair`) : `COULEURS` et `styles` sont recalculés par `appliquerPalette` — **ne plus écrire de couleur en dur, ajouter une clé aux deux palettes**.

Points clés :

- **Expo SDK 57** (imposé par l'Expo Go du téléphone de test : sur iOS, seule la
  dernière version d'Expo Go s'installe, donc le projet doit la suivre ; passé
  de 54 à 57 quand Expo Go a refusé le projet). Docs de la bonne version :
  https://docs.expo.dev/versions/v57.0.0/ — `npx expo install --fix` a besoin
  d'api.expo.dev ; sans réseau, aligner à la main sur
  `node_modules/expo/bundledNativeModules.json`.
- IA vision **interchangeable** (`ia.js`) : **Google Gemini** (`gemini-flash-latest`,
  API REST en `fetch`), **Claude** (`claude-opus-5-5`, SDK `@anthropic-ai/sdk`,
  sorties structurées + `fallbacks: "default"`), **ChatGPT** et **Mistral** (API
  « chat completions » en `fetch`, modèle choisi à l'ajout de la clé parmi ceux
  qu'elle autorise : `choisirModele`). L'utilisateur colle **une clé, n'importe
  laquelle** dans les Paramètres : `reconnaitreCle` devine l'IA d'après son
  préfixe (`sk-ant-`, `AIza`/`AQ.`, `sk-`, sinon on essaie tout) et la vérifie
  en listant les modèles. Plusieurs clés → **Gemini toujours en premier**
  (`ordreIA`), puis les autres ; au moindre échec d'une IA (surcharge, clé
  refusée, réponse illisible…), `appelerIA` passe à la suivante, et si toutes
  échouent le message liste la réponse de chacune. Les schémas
  sont écrits au format Gemini dans `analyse.js` et convertis pour Claude
  (`versJsonSchema`). Nouvelle IA → une fonction dans `APPELS` + une entrée dans
  `FOURNISSEURS` (`cle.js`).
- Les clés API sont dans `secrets.js` (exclu de Git : `GEMINI_API_KEY`,
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MISTRAL_API_KEY`). Ne jamais les commiter, ne jamais les remettre en clair
  dans le code. `cle.js` les résout à l'exécution : clé saisie dans les
  Paramètres (persistée localement) sinon clé de `secrets.js`. La version web publiée sur GitHub Pages n'embarque AUCUNE clé.

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

Quatre onglets — **Photo** (analyse d'un plat par photo, **scan de
code-barres** ou **recherche manuelle** d'un aliment dans Ciqual — sans IA ;
si l'aliment exact n'y est pas, la recherche propose les produits de marque
d'Open Food Facts (fiches aberrantes écartées : `sansAberrations`), puis — seulement
si OFF ne trouve rien ou échoue — l'aliment générique le plus proche selon l'IA
(`alimentsProches` dans `analyse.js` : l'IA ne donne que des mots, les valeurs
restent Ciqual) et les fiches approchantes), **Progression** (niveau/XP/badges + courbe de poids + calories),
**Bilan** (calories restantes du jour ; la barre montre la zone « journée
validée » — 80 % de l'objectif à 110 % du budget, `zoneCible` dans `jeu.js`,
même règle que `jourReussi` — pour ne pas viser pile le budget), **Journal** (calendrier Année/Mois/Semaine/Jour de tous les jours depuis le
premier lancement, pincer pour zoomer, détail des repas). Onboarding obligatoire au 1er lancement ;
objectif réglable ensuite via la **roue crantée** (menu Paramètres, haut gauche).
Tout est persisté localement (`stockage.js`).

Le scan de code-barres (`expo-camera`) interroge **Open Food Facts** et empile
plusieurs produits dans une même analyse (avec anti-doublon) ; les produits
passent dans le même affichage/bilan que les aliments d'une photo.

## Fichiers

| Fichier | Rôle |
|---|---|
| `App.js` | les 4 onglets, l'onboarding, les paramètres |
| `analyse.js` | passe 1 (vision) et passe 2 (choix de la fiche Ciqual) : prompts et schémas |
| `ia.js` | reconnaissance d'une clé collée + appel aux IA (Gemini en priorité, puis Claude / ChatGPT / Mistral), relais sur la suivante au moindre échec |
| `ciqual.js` | recherche dans la table (`rechercher`, utilisée par l'analyse photo — ne pas en changer le classement à la légère) + recherche tolérante aux fautes pour la saisie manuelle (`rechercherApprochant`, `couverture`, `correspondExacte`) + calcul nutritionnel |
| `off.js` | **Open Food Facts** : scan de code-barres et recherche de produits de marque par nom (`chercherProduits`), mis à la forme d'une fiche (compatible `calculer()`) |
| `besoins.js` | BMR/objectif calorique + bilan du jour, garde-fous de sécurité |
| `health.js` | lecture de la dépense : Apple Santé (HealthKit) sur iPhone, **Health Connect** (`react-native-health-connect`, permissions dans `app.json`, minSdk 26 via `expo-build-properties`) sur Android ; `NOM_SANTE` / `MESSAGE_SANTE_INDISPONIBLE` pour l'interface |
| `stockage.js` | persistance locale (AsyncStorage) + bascule de journée à minuit |
| `jeu.js` | gamification : XP, niveaux, badges, étapes du perso (`PALIERS_PERSO`, `PERSOS`, `etapePersonnage`) + palette du thème par niveau |
| `perso-sprites.js` | **généré** par `tools/build-perso.js` : table des sprites `SPRITES[perso][étape][direction]` |
| `assets/perso/` | GIF PixelLab sources (`humain/h1..20.gif`, `chat/c1..20.gif`) + PNG générés dans `rot/` ; animations dans `anim/<nom>/` (GIF ou dossier `south/` de l'export ZIP PixelLab) |
| `tuto.js` | tutoriel du 1er lancement en « projecteur » (écran assombri sauf l'élément montré), 23 étapes sur toute l'app (`ETAPES_TUTO`) ; les vues s'enregistrent via `ref={cible("id")}`, les pages qui défilent via `useDefilTuto` ; une 2ᵉ instance dans la Modal des Paramètres ; `etat.tutoVu`, « Revoir le tutoriel » dans les Paramètres. **Nouvel élément d'interface → lui ajouter une étape.** |
| `journal.js` | onglet **Journal**, calendrier façon Apple (Année / Mois / Semaine / Jour, on pince pour zoomer ; grilles et navigation : `grilleMois`, `semaineDe`, `decalerPeriode`…) : tous les jours depuis `etat.debut` (1er lancement), verdict par jour via `jourReussi` (jamais de félicitations pour une sous-alimentation), repas de chaque jour (`jour.repas`, archivés à minuit) |
| `lien.js` | lien entrant `caloriecam://sport?kcal=N` (raccourci iOS qui lit Apple Santé quand l'app sideloadée n'a pas HealthKit) → remplace le sport du jour |
| `version.js` | numéro de version affiché dans les Paramètres (`local` ; réécrit par le workflow Expo Go) |
| `cle.js` | clés API par IA (saisies dans l'app ou `secrets.js`) + IA choisie |
| `data/ciqual.json` | table réduite (235 Ko), **versionnée** — ne pas régénérer sans raison |
| `tools/` | outils hors-app : `build-ciqual.js` (conversion de la table ANSES), `build-perso.js` (GIF PixelLab → sprites de l'app) |

## Invariants à ne pas casser

- **`health.js` doit toujours se dégrader proprement dans Expo Go.** HealthKit
  et Health Connect sont natifs et absents d'Expo Go : le module natif est chargé en *lazy require*
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
  perso) : publie la branche par EAS Update, **iOS et Android** (`--platform all`) (secret `EXPO_TOKEN`), numérotée
  `perso-<n>` — le numéro s'affiche en bas des Paramètres (`version.js`, réécrit
  par le workflow, qui y active aussi la section de test).
- **.ipa non signé** (`.github/workflows/ipa.yml`, commit contenant `[ipa]`) :
  compilé sur un Mac GitHub, publié en pre-release `ipa-<n>`, installé via
  SideStore. La signature gratuite retire l'entitlement HealthKit (vérifié : il
  est bien dans l'ipa) → Apple Santé passe par un raccourci iOS et `lien.js`.
  ⚠️ **Ne jamais mettre `[ipa]` dans un commit sans demande explicite de
  l'utilisateur** : chaque build macOS coûte ~12 min × 10 sur le quota gratuit
  du dépôt privé. Pousser sans `[ipa]`, et ne lancer un build que sur demande.
- **APK Android** (`.github/workflows/apk.yml`, commit contenant `[apk]` ou
  « Run workflow ») : compilé sur Linux (minutes ×1), publié en pre-release
  `apk-<n>`, installable directement (signé avec la clef de debug : pas pour
  le Play Store). Health Connect y marche. Comme pour l'ipa, ne lancer un build
  que quand c'est utile (pas à chaque commit).
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
