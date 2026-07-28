# Contexte pour un assistant IA

Ce projet (**CalorieCam**) est décrit en détail dans le `README.md` — le lire en premier.

Points clés :

- **Expo SDK 54** (imposé par la version d'Expo Go du téléphone de test). Ne pas
  mettre à jour vers un SDK plus récent sans vérifier ce que supporte l'Expo Go
  installé. Docs de la bonne version : https://docs.expo.dev/versions/v54.0.0/
- IA vision : **Google Gemini**, modèle `gemini-flash-latest`. Le code appelle
  l'API REST directement (`fetch`) dans `gemini.js`.
- La clé API est dans `secrets.js` (exclu de Git). Ne jamais la commiter, ne
  jamais la remettre en clair dans le code.

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

Trois onglets — **Photo** (analyse d'un plat), **Progression** (avatar/niveaux +
courbe de poids + calories), **Bilan** (calories restantes du jour). Onboarding
obligatoire au 1er lancement ; objectif réglable ensuite via la **roue crantée**
(menu Paramètres, haut gauche). Tout est persisté localement (`stockage.js`).

## Fichiers

| Fichier | Rôle |
|---|---|
| `App.js` | les 3 onglets, l'onboarding, les paramètres, l'avatar rotatif |
| `gemini.js` | passe 1 (vision) et passe 2 (choix de la fiche Ciqual) |
| `ciqual.js` | recherche floue dans la table + calcul nutritionnel |
| `besoins.js` | BMR/objectif calorique + bilan du jour, garde-fous de sécurité |
| `health.js` | lecture de la dépense via Apple Santé (HealthKit) |
| `stockage.js` | persistance locale (AsyncStorage) + bascule de journée à minuit |
| `jeu.js` | gamification : XP, niveaux, badges, étapes du personnage |
| `sprites.js` | lecteur de sprites pixel (grille + palette) — cf. `tools/sprite-studio.html` |
| `data/ciqual.json` | table réduite (235 Ko), **versionnée** — ne pas régénérer sans raison |
| `assets/hero/` | frames du personnage + rotations 8 directions par niveau (`rot/`, `rot2/`…) |
| `tools/` | outils hors-app : conversion Ciqual, découpe/détourage/rotation des sprites |

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

## Deux modes d'exécution

- **Expo Go** (`npx expo start`) : tout marche SAUF Apple Santé.
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
