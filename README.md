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

```bash
git clone <URL-DU-REPO>
cd calorie-cam-app
npm install
```

Puis créer le fichier de clé (il n'est PAS dans le repo, pour des raisons de sécurité) :

```powershell
Copy-Item secrets.example.js secrets.js
notepad secrets.js
```

Coller sa clé Gemini (gratuite : https://aistudio.google.com/apikey) dans `secrets.js`, enregistrer.

Enfin, lancer le serveur :

```bash
npx expo start
```

Un QR code apparaît → le scanner avec l'appareil photo de l'iPhone (Expo Go
installé, sur le même Wi-Fi que le PC).

## Sécurité

- La clé API est dans `secrets.js`, **jamais commité** (voir `.gitignore`).
- Elle est en clair dans l'app : OK pour tester sur son propre iPhone, mais
  **ne jamais distribuer l'app ainsi**. Pour une vraie app publiée → passer par
  un petit backend qui garde la clé cachée.

## Mettre à jour la table Ciqual

Le JSON est versionné dans Git : il n'y a rien à faire pour développer. Ce n'est
utile que quand l'ANSES publie une nouvelle table.

1. Télécharger [l'archive XML](https://ciqual.anses.fr/cms/sites/default/files/inline-files/XML_2020_07_07.zip)
   depuis [ciqual.anses.fr](https://ciqual.anses.fr) et la décompresser
2. `node tools/build-ciqual.js <dossier-des-xml>`

Données publiées sous **Licence Ouverte (Etalab)**.

## Où on en est / prochaines étapes

- [x] Prototype fonctionnel : photo → détection → calories/macros
- [x] Remplacer les valeurs nutritionnelles inventées par l'IA par la base
      **Ciqual** de l'ANSES (2 298 aliments, hors-ligne)
- [x] Améliorer les estimations de portions : repères d'échelle et portions
      usuelles dans le prompt, fourchette min/max affichée, et **correction
      manuelle du poids** avec recalcul immédiat
- [ ] Valider la précision sur des repas réels **et pesés** (voir ci-dessous)
- [ ] Ajouter un **journal** (stockage local des plats de la journée + total)
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

- **« incompatible with this version of Expo Go »** → le projet est sur un SDK
  plus récent que l'Expo Go de l'iPhone. Aligner le projet :
  `npm install expo@~54.0.0` puis `npx expo install --fix`.
- **« Unable to resolve ./secrets »** → le fichier `secrets.js` n'existe pas sur
  cette machine. Le recréer depuis `secrets.example.js`.
- **« model ... is no longer available »** → le nom du modèle Gemini a changé ;
  mettre à jour la constante `MODELE` dans `App.js`.
