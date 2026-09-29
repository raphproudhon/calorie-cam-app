// Lecture de la depense energetique : Apple Sante (HealthKit) sur iPhone,
// Health Connect sur Android.
//
// IMPORTANT — ce module ne fonctionne PAS dans Expo Go : HealthKit et Health
// Connect sont du code natif, absent de l'app Expo Go. Il ne s'active que dans
// l'app installee (ipa, APK, build de developpement). Ici, tout est ecrit pour DEGRADER PROPREMENT : dans Expo Go,
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

// Health Connect (Android) : energie active, et depense totale (repos = total -
// active). Il faut les permissions correspondantes dans app.json.
const HC_ACTIVE = "ActiveCaloriesBurned";
const HC_TOTALE = "TotalCaloriesBurned";
const HC_DISPONIBLE = 3; // SdkAvailabilityStatus.SDK_AVAILABLE

const ANDROID = Platform.OS === "android";

/** Nom de la source de sante sur cette plateforme (pour l'interface). */
export const NOM_SANTE = ANDROID ? "Health Connect" : "Apple Santé";

/** Ce qu'on explique quand l'import automatique n'est pas possible ici. */
export const MESSAGE_SANTE_INDISPONIBLE = ANDROID
  ? "Dans Expo Go, l'import depuis Health Connect n'est pas possible : il faut l'APK de CalorieCam. En attendant, saisissez vos calories à la main."
  : "Dans Expo Go, l'import depuis Apple Santé n'est pas possible : utilisez l'app installée (ou votre raccourci Santé). En attendant, saisissez vos calories à la main.";

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
    _hk = ANDROID
      ? require("react-native-health-connect")
      : require("@kingstinct/react-native-healthkit");
  } catch (e) {
    _hk = null;
  }
  return _hk;
}

/**
 * La lecture de sante est-elle utilisable ici ?
 * Faux dans Expo Go, sur le web, ou si le natif ne repond pas. Sur Android, la
 * presence de l'app Health Connect est verifiee a la demande d'acces.
 */
export function estDisponible() {
  if (Platform.OS !== "ios" && !ANDROID) return false;
  const hk = moduleNatif();
  if (!hk) return false;
  if (ANDROID) return typeof hk.initialize === "function";
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
  if (ANDROID) return demanderAccesAndroid();
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
  if (ANDROID) return depenseDuJourAndroid(date);
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

// --- Android : Health Connect ------------------------------------------------

/** Initialise Health Connect, ou explique pourquoi c'est impossible. */
async function healthConnect() {
  const hc = moduleNatif();
  if (!hc) throw new Error("Health Connect indisponible (il faut l'APK de CalorieCam).");
  const statut = await hc.getSdkStatus();
  if (statut !== HC_DISPONIBLE) {
    throw new Error(
      "Health Connect n'est pas installé ou doit être mis à jour : installez « Health Connect » depuis le Play Store, puis réessayez."
    );
  }
  if (!(await hc.initialize())) throw new Error("Health Connect n'a pas pu démarrer.");
  return hc;
}

async function demanderAccesAndroid() {
  const hc = await healthConnect();
  const accordees = await hc.requestPermission([
    { accessType: "read", recordType: HC_ACTIVE },
    { accessType: "read", recordType: HC_TOTALE },
  ]);
  // Contrairement a iOS, Android dit ce qui a ete accorde.
  if (!accordees.some((p) => p.recordType === HC_ACTIVE)) {
    throw new Error("Accès aux calories refusé dans Health Connect.");
  }
  return true;
}

/** Total en kcal d'un type d'enregistrement sur l'intervalle, ou null. */
async function totalHC(hc, recordType, champ, debut, fin) {
  try {
    const r = await hc.aggregateRecord({
      recordType,
      timeRangeFilter: { operator: "between", startTime: debut.toISOString(), endTime: fin.toISOString() },
    });
    const v = Number(r?.[champ]?.inKilocalories);
    return Number.isFinite(v) ? Math.round(v) : null;
  } catch (e) {
    return null; // permission refusee pour ce type, ou aucune donnee
  }
}

async function depenseDuJourAndroid(date) {
  const hc = await healthConnect();
  const debut = new Date(date);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(date);
  fin.setHours(23, 59, 59, 999);
  const active = await totalHC(hc, HC_ACTIVE, "ACTIVE_CALORIES_TOTAL", debut, fin);
  const totale = await totalHC(hc, HC_TOTALE, "ENERGY_TOTAL", debut, fin);
  const repos = totale != null && active != null ? Math.max(0, totale - active) : null;
  return { active, repos, totale };
}
