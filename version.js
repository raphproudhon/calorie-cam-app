// Numero de version affiche en bas des Parametres.
//
// En local, ce fichier reste tel quel. Le workflow .github/workflows/expo-go.yml
// le reecrit avant chaque publication dans Expo Go : VERSION devient
// "perso-<numero> · <commit>", et TEST passe a true pour garder la section de
// test (XP, changer de perso) dans ces versions, compilees en mode production.
export const VERSION = "local";
export const TEST = false;
