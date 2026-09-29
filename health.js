// Lecture de la depense energetique depuis Apple Sante (HealthKit).
//
// IMPORTANT — ce module ne fonctionne PAS dans Expo Go : HealthKit est du code
// natif, absent de l'app Expo Go. Il ne s'active que dans un "development build"
// (voir README). Ici, tout est ecrit pour DEGRADER PROPREMENT : dans Expo Go,
// aucune fonction ne plante, `estDisponible()` renvoie simplement false et
// l'interface affiche un message au lieu de crasher.
//
// C'est pourquoi le module natif est charge en "lazy require" dans un try/catch,
// jamais importe en tete de fichier : le simple fait d'ouvrir l'app dans Expo Go
// ne doit toucher a rien de natif.

import { Platform } from "react-native";
import Constants from "expo-constants";

// Expo Go ne contient aucun module natif : y charger HealthKit / NitroModules
// leve une erreur qu'un try/catch synchrone ne rattrape pas (le module plante
// au chargement). On detecte donc Expo Go pour ne JAMAIS tenter le require.
const DANS_EXPO_GO = Constants.executionEnvironment === "storeClient";

// Types HealthKit lus. L'energie "active" = depense de mouvement (anneau Bouger
// d'Apple Forme) ; l'energie "de repos" = metabolisme de base mesure. La depense
// totale de la journee est la somme des deux — c'est l'equivalent mesure de la
// TDEE que besoins.js ne fait qu'estimer.
const TYPE_ACTIVE = "HKQuantityTypeIdentifierActiveEnergyBurned";
const TYPE_REPOS = "HKQuantityTypeIdentifierBasalEnergyBurned";

// Chargement paresseux et protege du module natif. Memoise apres le 1er appel.
let _hk = null;
let _charge = false;
function moduleNatif() {
  if (_charge) return _hk;
  _charge = true;
  // Dans Expo Go, le natif est absent et son chargement plante l'app
  // (erreur NitroModules non rattrapable) : on n'essaie meme pas.
  if (DANS_EXPO_GO) {
    _hk = null;
    return _hk;
  }
  try {
    // require (et non import) pour contenir toute erreur native ici meme.
    _hk = require("@kingstinct/react-native-healthkit");
  } catch (e) {
    _hk = null;
  }
  return _hk;
}

/**
 * HealthKit est-il utilisable ici ?
 * Faux dans Expo Go, sur Android, ou si le natif ne repond pas.
 */
export function estDisponible() {
  if (Platform.OS !== "ios") return false;
  const hk = moduleNatif();
  if (!hk) return false;
  try {
    // Selon la version, la fonction est sync ou async ; on ne l'appelle que si
    // elle existe et est synchrone, sinon on se contente de la presence du module.
    const f = hk.isHealthDataAvailable;
    if (typeof f === "function") {
      const r = f();
      // Si la fonction renvoie une promesse, on ne peut pas trancher ici :
      // on considere le module present comme "disponible" et on laissera
      // l'autorisation confirmer.
      return typeof r === "boolean" ? r : true;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Demande l'autorisation de LECTURE de la depense energetique.
 * @returns {Promise<boolean>} true si la demande a pu etre presentee.
 *
 * Note : sur iOS, l'API ne dit pas si l'utilisateur a accepte (par choix
 * d'Apple, pour la confidentialite). Un `true` signifie que la boite de dialogue
 * a ete presentee, pas forcement que l'acces est accorde — on le decouvre en
 * lisant les donnees.
 */
export async function demanderAcces() {
  const hk = moduleNatif();
  if (!hk || typeof hk.requestAuthorization !== "function") {
    throw new Error("HealthKit indisponible (build de développement requis).");
  }
  await hk.requestAuthorization({ toRead: [TYPE_ACTIVE, TYPE_REPOS] });
  return true;
}

/** Somme les teneurs des echantillons d'un type sur un intervalle (en kcal). */
async function sommeEnergie(hk, type, debut, fin) {
  if (typeof hk.queryQuantitySamples !== "function") return null;
  const echantillons = await hk.queryQuantitySamples(type, {
    filter: { date: { startDate: debut, endDate: fin } },
    limit: 0, // 0 = tous les echantillons (champ obligatoire depuis la v16)
  });
  if (!Array.isArray(echantillons)) return null;
  // Chaque echantillon d'energie est en kcal ; on additionne les teneurs.
  let total = 0;
  for (const e of echantillons) {
    const v = Number(e?.quantity);
    if (Number.isFinite(v)) total += v;
  }
  return Math.round(total);
}

/**
 * Depense energetique d'une journee, lue depuis Apple Sante.
 * @param {Date} date  n'importe quel instant du jour voulu (defaut : aujourd'hui)
 * @returns {Promise<{active:number|null, repos:number|null, totale:number|null}>}
 *
 * `null` sur un poste = donnee non disponible (acces refuse, ou aucune mesure
 * ce jour-la). L'appelant distingue ainsi "0 kcal mesure" de "pas de donnee".
 */
export async function depenseDuJour(date = new Date()) {
  const hk = moduleNatif();
  if (!hk) throw new Error("HealthKit indisponible (build de développement requis).");

  const debut = new Date(date);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(date);
  fin.setHours(23, 59, 59, 999);

  const active = await sommeEnergie(hk, TYPE_ACTIVE, debut, fin);
  const repos = await sommeEnergie(hk, TYPE_REPOS, debut, fin);
  const totale =
    active == null && repos == null ? null : (active || 0) + (repos || 0);

  return { active, repos, totale };
}
