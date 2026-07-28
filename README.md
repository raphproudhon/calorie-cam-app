# CalorieCam

Prototype d'app mobile qui analyse une **photo de plat** et estime les
**calories + macros** (protéines, glucides, lipides) via l'IA vision de Google
Gemini.

## Ce que fait l'app

1. On prend une photo d'un plat (ou on la choisit dans la galerie)
2. Gemini identifie les aliments et **estime leurs portions en grammes**
3. Chaque aliment est rattaché à sa fiche de la table **Ciqual de l'ANSES**
4. Les calories et macros sont calculées à partir de cette base officielle
5. On peut **corriger le poids** de chaque aliment : tout se recalcule aussitôt

### Pourquoi l'IA ne calcule pas les calories

L'IA est bonne pour *reconnaître* un aliment sur une photo, mauvaise pour
*réciter* des valeurs nutritionnelles — elle les invente, sans moyen de le
vérifier. Les deux métiers sont donc séparés :

| Qui | Fait quoi |
|---|---|
| **Gemini** | identifie les aliments, estime les masses (vision) |
| **Ciqual (ANSES)** | fournit les valeurs pour 100 g (source de vérité) |
| **L'app** | calcule `masse / 100 × valeurs Ciqual`, et laisse corriger la masse |

Le rattachement aliment → fiche Ciqual se fait en deux temps : une recherche
locale sort ~8 fiches candidates, puis un second appel Gemini (texte seul,
rapide) choisit la bonne. Une recherche textuelle seule trouve la bonne fiche
en 1ʳᵉ position dans 84 % des cas, mais elle est dans le top 8 dans 96 % des
cas — d'où le choix de faire trancher le modèle dans une liste courte plutôt
que de lui demander de deviner un code parmi 2 298.

### Objectif calorique et bilan du jour

Trois onglets : **Photo**, **Progression**, **Bilan**. L'objectif calorique se
règle à l'**onboarding** (1er lancement) puis via la **roue crantée**
(Paramètres) — ce n'est plus un onglet.

Le calcul du besoin de base (formule Mifflin-St Jeor) applique des garde-fous de
sécurité (plancher 1200/1500 kcal, déficit modéré). Choix d'architecture
important :

> **Le niveau d'activité n'entre pas dans le calcul de l'objectif.** L'objectif
> de base représente le maintien **au repos** (BMR × 1,2, hors sport). La seule
> dépense de sport prise en compte est celle lue depuis **Apple Santé** (énergie
> active), ajoutée dans l'onglet Bilan. Cela évite tout double comptage : le
> sport n'est jamais estimé, seulement mesuré.

L'onglet **Bilan** applique le modèle « add-back » :

```
calories restantes = objectif de base + sport (Apple Santé) − déjà consommé
```

Exemple : objectif 2000 kcal, séance à 300 kcal → budget du jour 2300 kcal.
Le « consommé » vient de l'onglet Photo (bouton « Ajouter au bilan »). En
attendant le build de développement, le sport peut être saisi à la main.

## Stack technique

| Élément | Choix |
|---|---|
| Framework | **Expo (React Native)** — teste sur iPhone via l'app **Expo Go**, sans Mac |
| Expo SDK | **54** (⚠️ ne PAS mettre à jour au-delà de ce que supporte l'Expo Go installé) |
| IA vision | **Google Gemini** — modèle `gemini-flash-latest` (niveau gratuit) |
| Base nutritionnelle | **Ciqual 2020 (ANSES)** — 2 298 aliments, embarquée, hors-ligne |
| Clé API | Dans `secrets.js` (exclu de Git) — voir `secrets.example.js` |

### Organisation des fichiers

| Fichier | Rôle |
|---|---|
| `App.js` | l'écran : affichage et correction manuelle des portions |
| `gemini.js` | les deux appels à l'IA (vision, puis choix de la fiche Ciqual) |
| `ciqual.js` | recherche dans la table et calcul nutritionnel |
| `data/ciqual.json` | la table Ciqual réduite (235 Ko), versionnée dans Git |
| `tools/build-ciqual.js` | régénère ce JSON depuis les fichiers officiels de l'ANSES |

## Lancer le projet (sur un nouvel ordinateur)

Pré-requis : **Node.js** (nodejs.org) et **Git** installés.

> ⚠️ **Ne pas cloner dans OneDrive, Dropbox ou iCloud.** Ces outils ne
> fusionnent pas : quand deux machines touchent au même fichier, ils créent une
> copie suffixée du nom de l'ordinateur (`secrets-<machine>.js`). Ces copies
> contiennent la vraie clé API et échappent aux règles du `.gitignore` écrites
> pour le nom exact. Pire, la synchronisation peut rembobiner les références de
> `.git` et faire croire à une désynchronisation avec GitHub. Un dossier local
> simple (`C:\dev\`) évite tout ça — GitHub est déjà la sauvegarde.

```bash
git clone https://github.com/raphproudhon/calorie-cam-app.git C:/dev/calorie-cam-app
cd C:/dev/calorie-cam-app
npm install
```

Puis créer le fichier de clé (il n'est PAS dans le repo, pour des raisons de sécurité) :

```powershell
Copy-Item secrets.example.js secrets.js
notepad secrets.js
```

Coller sa clé Gemini (gratuite : https://aistudio.google.com/apikey) dans
`secrets.js`, enregistrer. Les clés récentes commencent par `AQ.` au lieu de
`AIza` — les deux fonctionnent.

Enfin, lancer le serveur :

```bash
npx expo start
```

Un QR code apparaît → le scanner avec l'appareil photo de l'iPhone.

**L'iPhone doit être en Wi-Fi, sur le même réseau que le PC.** Expo Go se
connecte à une adresse locale (`exp://192.168.x.x:8081`), qui n'existe pas
depuis internet : en 4G/5G, la connexion expire sans message clair.

## Sécurité

- La clé API est dans `secrets.js`, **jamais commité** (voir `.gitignore`, qui
  couvre `secrets*.js` et pas seulement le nom exact).
- Elle est envoyée dans l'en-tête HTTP `x-goog-api-key`, **jamais dans l'URL** :
  une clé en paramètre de requête se retrouve dans les journaux de tous les
  serveurs et proxys traversés.
- Elle reste en clair dans l'app : OK pour tester sur son propre iPhone, mais
  **ne jamais distribuer l'app ainsi**. Pour une vraie app publiée → passer par
  un petit backend qui garde la clé cachée.

## Mettre à jour la table Ciqual

Le JSON est versionné dans Git : il n'y a rien à faire pour développer. Ce n'est
utile que quand l'ANSES publie une nouvelle table.

1. Télécharger [l'archive XML](https://ciqual.anses.fr/cms/sites/default/files/inline-files/XML_2020_07_07.zip)
   depuis [ciqual.anses.fr](https://ciqual.anses.fr) et la décompresser
2. `node tools/build-ciqual.js <dossier-des-xml>`

Données publiées sous **Licence Ouverte (Etalab)**.

## Apple Santé — dépense calorique (build de développement requis)

L'onglet **Bilan** peut importer la dépense de sport réelle (calories actives)
depuis **Apple Santé**, pour l'ajouter au budget du jour. Le code est en place
(`health.js`, plugin dans `app.json`), mais :

> ⚠️ **HealthKit ne fonctionne pas dans Expo Go.** C'est du code natif : il faut
> un **build de développement** (une version compilée sur mesure de l'app). Dans
> Expo Go, l'app tourne normalement mais la carte Apple Santé affiche
> « build de développement requis » au lieu de planter.

Les autres fonctions (photo, calcul d'objectif) continuent de marcher dans Expo Go.

### Faire le build

Le build se fait dans le cloud avec **EAS** (pas besoin de Mac). Il faut choisir
une voie Apple pour l'installer sur l'iPhone :

| Voie | Mac ? | Coût | Contrainte |
|---|---|---|---|
| Apple Developer Program | non | 99 €/an | installation fluide, pas de re-signature |
| Compte Apple gratuit | oui (Xcode) | 0 € | re-signature tous les 7 jours, 3 appareils |

Une fois la voie choisie :

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile development
```

EAS guide la configuration de signature. À la fin, un QR code installe le build
sur l'iPhone. On lance ensuite `npx expo start --dev-client` (au lieu de
`npx expo start`) et on ouvre l'app installée, pas Expo Go.

La configuration technique (entitlement HealthKit, descriptions d'usage Santé,
`bundleIdentifier`) est déjà dans `app.json` — EAS l'applique automatiquement.

## Où on en est / prochaines étapes

- [x] Prototype fonctionnel : photo → détection → calories/macros
- [x] Remplacer les valeurs nutritionnelles inventées par l'IA par la base
      **Ciqual** de l'ANSES (2 298 aliments, hors-ligne)
- [x] Améliorer les estimations de portions : repères d'échelle et portions
      usuelles dans le prompt, fourchette min/max affichée, et **correction
      manuelle du poids** avec recalcul immédiat
- [x] **Calculateur de besoin calorique** : BMR Mifflin-St Jeor, objectif
      perte/prise avec garde-fous de sécurité (réglé à l'onboarding puis dans
      les Paramètres). L'activité n'entre pas dans le calcul ; la dépense de
      sport vient d'Apple Santé (ou saisie manuelle) et s'ajoute au Bilan.
- [x] **Onglet Bilan** : calories restantes du jour = objectif + sport − consommé
- [x] **Persistance locale** (AsyncStorage) : profil, historique, poids ;
      bascule de journée à minuit (archivage de la veille)
- [x] **Onglet Progression** : avatar/personnage **évolutif par niveau** (image
      + rotation 8 directions au doigt), courbe de poids, historique des calories
- [x] **Gamification** (`jeu.js`) : XP, niveaux, badges. Garde-fou santé : la
      sous-alimentation ne rapporte jamais le bonus « cible »
- [~] **Apple Santé** : lecture de la dépense réelle — code prêt, nécessite le
      build de développement ci-dessus pour fonctionner
- [~] **Avatar** : personnages générés (PixelLab) intégrés niveau par niveau —
      en cours (niveaux 1-2 faits ; voir `tools/extract-rotations.js`)
- [ ] Valider la précision sur des repas réels **et pesés** (voir ci-dessous)
- [ ] Journal détaillé des plats de la journée (au-delà du total)
- [ ] Scan de code-barres pour les produits emballés (via Open Food Facts)
- [ ] À terme : app iOS native (SwiftUI) si le concept est validé

### Comment valider la précision pour de bon

Ce qui est fait améliore l'estimation, mais ne la *mesure* pas. La seule
méthode fiable : peser les aliments à la balance de cuisine, photographier,
puis comparer au poids annoncé par l'app. Une vingtaine de plats suffisent à
voir si l'erreur est systématique (l'IA sous-estime souvent les volumes en
oubliant la hauteur) ou aléatoire. Un biais systématique se corrige dans le
prompt ; une dispersion aléatoire ne se corrige que par la saisie manuelle.

## Notes de dépannage

- **« The request timed out » dans Expo Go** → l'iPhone n'est pas sur le même
  réseau que le PC (souvent : il est resté en 4G). Passer en Wi-Fi. À défaut,
  `npx expo start --tunnel` fait transiter la connexion par internet — ça
  fonctionne en 4G mais c'est nettement plus lent, à réserver au dépannage.
- **« EADDRINUSE: address already in use :::8081 »** → un serveur Metro tourne
  déjà, probablement dans une fenêtre fermée ou oubliée. Vérifier avec
  `curl http://localhost:8081/status` : s'il répond `packager-status:running`,
  il suffit de s'y connecter. Sinon, le libérer :
  `powershell -Command "Get-NetTCPConnection -LocalPort 8081 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`
- **« incompatible with this version of Expo Go »** → le projet est sur un SDK
  plus récent que l'Expo Go de l'iPhone. Aligner le projet :
  `npm install expo@~54.0.0` puis `npx expo install --fix`.
- **« Unable to resolve ./secrets »** → le fichier `secrets.js` n'existe pas sur
  cette machine. Le recréer depuis `secrets.example.js`.
- **« model ... is no longer available »** → le nom du modèle Gemini a changé ;
  mettre à jour la constante `MODELE` dans `gemini.js`.
- **Fichiers `-<nom-machine>` qui apparaissent** (`secrets-ordiraph.js`) → ce
  sont des copies de conflit créées par OneDrive. Signe que le dossier est
  synchronisé : voir l'avertissement plus haut.
