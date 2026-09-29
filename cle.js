// Cles API des IA vision, et choix de l'IA utilisee.
//
// L'app sait parler a plusieurs IA (voir ia.js) : Gemini (Google) et Claude
// (Anthropic). L'utilisateur choisit la sienne dans les Parametres ; si elle
// est surchargee et qu'une cle existe pour l'autre, l'analyse bascule dessus.
//
// Pour chaque IA, deux provenances de cle, dans cet ordre de priorite :
//   1. une cle saisie dans l'app (Parametres -> "Intelligence artificielle"),
//      persistee localement (AsyncStorage, donc localStorage cote web) ;
//   2. la cle du fichier "secrets.js" du poste de developpement.
//
// La 1re existe pour les versions publiees (web, Expo Go, ipa) : on n'y
// embarque AUCUNE cle (secrets.js y vaut le placeholder du modele). Chacun
// colle la sienne, elle reste sur SON appareil et n'est jamais commitee ni
// envoyee ailleurs qu'a l'IA concernee.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as secrets from "./secrets";

const PLACEHOLDER = "COLLE_TA_CLE_ICI";
const CLE_FOURNISSEUR = "caloriecam.fournisseur_ia";

/** Les IA connues : identifiant -> libelle, cle de stockage, cle de secrets.js. */
export const FOURNISSEURS = {
  gemini: {
    nom: "Gemini",
    stockage: "caloriecam.cle_gemini", // nom historique, garde pour ne rien perdre
    secret: "GEMINI_API_KEY",
    aide: "Clé gratuite sur aistudio.google.com/apikey.",
  },
  claude: {
    nom: "Claude",
    stockage: "caloriecam.cle_claude",
    secret: "ANTHROPIC_API_KEY",
    aide: "Clé sur console.anthropic.com (payant : quelques centimes par photo).",
  },
};
export const IDS_FOURNISSEURS = Object.keys(FOURNISSEURS);

function nettoyer(valeur) {
  const s = String(valeur || "").trim();
  return !s || s === PLACEHOLDER ? "" : s;
}

// Cles du build (poste de dev). Vides dans les versions publiees.
const embarquees = Object.fromEntries(
  IDS_FOURNISSEURS.map((id) => [id, nettoyer(secrets[FOURNISSEURS[id].secret])])
);
const saisies = Object.fromEntries(IDS_FOURNISSEURS.map((id) => [id, ""]));
let actif = "gemini";

/** Cle a utiliser pour une IA ("" si aucune n'est disponible). */
export function cleDe(id) {
  return saisies[id] || embarquees[id] || "";
}

/** IA choisie par l'utilisateur. */
export function fournisseurActif() {
  return actif;
}

/** Charge les cles saisies et le choix d'IA (a appeler au demarrage). */
export async function chargerCle() {
  await Promise.all(
    IDS_FOURNISSEURS.map(async (id) => {
      try {
        saisies[id] = nettoyer(await AsyncStorage.getItem(FOURNISSEURS[id].stockage));
      } catch {
        saisies[id] = "";
      }
    })
  );
  try {
    const choix = await AsyncStorage.getItem(CLE_FOURNISSEUR);
    if (FOURNISSEURS[choix]) actif = choix;
  } catch {
    // Pas de stockage : on garde Gemini.
  }
}

/** Enregistre (ou efface, si vide) la cle saisie pour une IA. */
export async function definirCle(id, valeur) {
  saisies[id] = nettoyer(valeur);
  try {
    if (saisies[id]) await AsyncStorage.setItem(FOURNISSEURS[id].stockage, saisies[id]);
    else await AsyncStorage.removeItem(FOURNISSEURS[id].stockage);
  } catch {
    // Stockage indisponible : la cle reste valable pour la session en cours.
  }
  return saisies[id];
}

/** Change l'IA utilisee. */
export async function definirFournisseur(id) {
  if (!FOURNISSEURS[id]) return;
  actif = id;
  try {
    await AsyncStorage.setItem(CLE_FOURNISSEUR, id);
  } catch {
    // Stockage indisponible : le choix vaut pour la session en cours.
  }
}
