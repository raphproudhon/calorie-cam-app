# Contexte pour un assistant IA

Ce projet (**CalorieCam**) est décrit en détail dans le `README.md` — le lire en premier.

Points clés :

- **Expo SDK 54** (imposé par la version d'Expo Go du téléphone de test). Ne pas
  mettre à jour vers un SDK plus récent sans vérifier ce que supporte l'Expo Go
  installé. Docs de la bonne version : https://docs.expo.dev/versions/v54.0.0/
- IA vision : **Google Gemini**, modèle `gemini-flash-latest`. Le code appelle
  l'API REST directement (`fetch`) dans `App.js`.
- La clé API est dans `secrets.js` (exclu de Git). Ne jamais la commiter, ne
  jamais la remettre en clair dans `App.js`.
- Tout le code de l'app est dans `App.js` (un seul écran).
