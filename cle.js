// Resolution de la cle API Gemini.
//
// Deux provenances possibles, dans cet ordre de priorite :
//   1. une cle saisie dans l'app (Parametres -> "Cle API Gemini"), persistee
//      localement (AsyncStorage, donc localStorage cote web) ;
//   2. la cle du fichier "secrets.js" du poste de developpement.
//
// La 1re existe pour la version web publiee sur GitHub Pages : le bundle y est
// public, on n'y embarque donc AUCUNE cle (secrets.js y vaut le placeholder du
// modele). Chaque visiteur colle la sienne, elle reste dans SON navigateur et
// n'est jamais commitee ni envoyee ailleurs qu'a Google.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { GEMINI_API_KEY } from "./secrets";

const CLE_STOCKAGE = "caloriecam.cle_gemini";
const PLACEHOLDER = "COLLE_TA_CLE_ICI";

function nettoyer(valeur) {
  const s = String(valeur || "").trim();
  return !s || s === PLACEHOLDER ? "" : s;
}

// Cle du build (poste de dev). Vide pour la version web publiee.
const cleEmbarquee = nettoyer(GEMINI_API_KEY);
let cleSaisie = "";

/** true si le build embarque deja une cle (pas besoin d'en demander une). */
export function cleEmbarqueePresente() {
  return cleEmbarquee !== "";
}

/** Cle a utiliser pour les appels ("" si aucune n'est disponible). */
export function cleGemini() {
  return cleSaisie || cleEmbarquee;
}

/** Charge la cle saisie depuis le stockage local (a appeler au demarrage). */
export async function chargerCle() {
  try {
    cleSaisie = nettoyer(await AsyncStorage.getItem(CLE_STOCKAGE));
  } catch {
    cleSaisie = "";
  }
  return cleGemini();
}

/** Enregistre (ou efface, si vide) la cle saisie par l'utilisateur. */
export async function definirCle(valeur) {
  cleSaisie = nettoyer(valeur);
  try {
    if (cleSaisie) await AsyncStorage.setItem(CLE_STOCKAGE, cleSaisie);
    else await AsyncStorage.removeItem(CLE_STOCKAGE);
  } catch {
    // Stockage indisponible : la cle reste valable pour la session en cours.
  }
  return cleSaisie;
}
