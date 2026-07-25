# CalorieCam

Prototype d'app mobile qui analyse une **photo de plat** et estime les
**calories + macros** (protéines, glucides, lipides) via l'IA vision de Google
Gemini.

## Ce que fait l'app

1. On prend une photo d'un plat (ou on la choisit dans la galerie)
2. La photo est envoyée à l'API vision de Gemini
3. Gemini identifie le plat, les ingrédients, estime les portions en grammes
   et calcule calories + macros
4. Le résultat s'affiche dans l'app

## Stack technique

| Élément | Choix |
|---|---|
| Framework | **Expo (React Native)** — teste sur iPhone via l'app **Expo Go**, sans Mac |
| Expo SDK | **54** (⚠️ ne PAS mettre à jour au-delà de ce que supporte l'Expo Go installé) |
| IA vision | **Google Gemini** — modèle `gemini-flash-latest` (niveau gratuit) |
| Clé API | Dans `secrets.js` (exclu de Git) — voir `secrets.example.js` |

Le code de l'app tient dans un seul fichier : **`App.js`**.

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

## Où on en est / prochaines étapes

- [x] Prototype fonctionnel : photo → détection → calories/macros
- [ ] Valider la précision des estimations de portions sur des repas réels
- [ ] Remplacer les valeurs nutritionnelles de l'IA par une base fiable
      (**CIQUAL** de l'ANSES, ou **Open Food Facts**)
- [ ] Ajouter un **journal** (stockage local des plats de la journée + total)
- [ ] Scan de code-barres pour les produits emballés (via Open Food Facts)
- [ ] À terme : app iOS native (SwiftUI) si le concept est validé

## Notes de dépannage

- **« incompatible with this version of Expo Go »** → le projet est sur un SDK
  plus récent que l'Expo Go de l'iPhone. Aligner le projet :
  `npm install expo@~54.0.0` puis `npx expo install --fix`.
- **« Unable to resolve ./secrets »** → le fichier `secrets.js` n'existe pas sur
  cette machine. Le recréer depuis `secrets.example.js`.
- **« model ... is no longer available »** → le nom du modèle Gemini a changé ;
  mettre à jour la constante `MODELE` dans `App.js`.
