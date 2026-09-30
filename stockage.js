// Persistance locale de l'etat de l'app (AsyncStorage).
//
// Tout tient dans un seul objet JSON sous une seule cle : c'est simple, atomique
// (une ecriture = un etat coherent) et amplement suffisant pour le volume ici
// (un profil, un historique de jours, un journal de poids).
//
// Schema de l'etat :
//   {
//     version: 1,
//     profil:    { sexe, age, poids, taille, activite, but, rythme } | null,
//     objectif:  number | null,          // objectif calorique du jour (kcal)
//     debut:     "AAAA-MM-JJ",         // premier lancement (debut du journal)
//     jour:      { date, consomme, sport, repas, macros },   // journee EN COURS
//       macros : { prot, gluc, lip } en g, cumul des repas du jour
//     historique:[ { date, consomme, sport, objectif, repas, macros, quotas } ],  // jours passes
//       repas : [ { heure: "HH:MM", plat, kcal, prot, gluc, lip } ] (ajouts « Ajouter au bilan »)
//     quotas:    { proteines, glucides, lipides } | null, // g ; null = conseilles (besoins.js)
//     poids:     [ { date, valeur } ],   // journal de poids
//     perso:     "humain" | "chat" | null, // personnage choisi (definitif)
//   }
//
// profil === null signifie "premier lancement" -> on montre l'onboarding.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { jeuParDefaut, recompenserJourArchive } from "./jeu";
import { quotasMacros } from "./besoins";
import { plusAncienneDate } from "./journal";

const CLE = "caloriecam.etat.v1";

/** Date locale au format AAAA-MM-JJ (sert de cle de journee). */
export function dateDuJour(d = new Date()) {
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const j = String(d.getDate()).padStart(2, "0");
  return `${a}-${m}-${j}`;
}

/** Etat par defaut (premier lancement). */
function etatParDefaut() {
  return {
    version: 1,
    profil: null,
    objectif: null,
    debut: dateDuJour(),
    jour: { date: dateDuJour(), consomme: 0, sport: "", repas: [] },
    tutoVu: false, // tutoriel du premier lancement deja vu (voir tuto.js)
    historique: [],
    poids: [],
    perso: null,
    jeu: jeuParDefaut(),
  };
}

/**
 * Bascule de journee ("minuit automatique") : si la journee en cours ne
 * correspond plus a aujourd'hui, on l'archive dans l'historique (seulement si
 * l'utilisateur y a mange quelque chose) et on repart a zero pour aujourd'hui.
 *
 * Limite assumee : ceci s'execute a l'OUVERTURE de l'app, pas litteralement a
 * minuit — une app mobile ne tourne pas en tache de fond en continu. Du point de
 * vue de l'utilisateur, en rouvrant l'app le lendemain, la veille est archivee.
 *
 * @returns {boolean} true si un archivage a eu lieu (etat modifie).
 */
export function appliquerRollover(etat) {
  const aujourdhui = dateDuJour();
  if (!etat.jour || etat.jour.date === aujourdhui) return false;

  // On n'archive que les journees "vecues" (au moins un aliment ajoute), pour
  // ne pas polluer l'historique de jours vides ou l'app n'a pas ete ouverte.
  if ((etat.jour.consomme || 0) > 0) {
    etat.historique = etat.historique || [];
    const archive = {
      date: etat.jour.date,
      consomme: Math.round(etat.jour.consomme || 0),
      sport: parseInt(etat.jour.sport || "0", 10) || 0,
      objectif: etat.objectif || 0,
      repas: etat.jour.repas || [],
      macros: etat.jour.macros || null,
      quotas: quotasMacros(etat),
    };
    etat.historique.push(archive);
    // Garde-fou memoire : on borne l'historique aux ~730 derniers jours.
    if (etat.historique.length > 730) {
      etat.historique = etat.historique.slice(-730);
    }
    // Recompense ludique de la journee terminee (XP, serie, badges).
    etat.jeu = recompenserJourArchive(etat.jeu || jeuParDefaut(), archive);
  }

  etat.jour = { date: aujourdhui, consomme: 0, sport: "", repas: [] };
  return true;
}

/**
 * Charge l'etat depuis le stockage, applique la bascule de journee, et
 * renvoie l'etat pret a l'emploi. Ne jette jamais : en cas de donnee corrompue,
 * repart d'un etat par defaut.
 */
export async function chargerEtat() {
  let etat;
  try {
    const brut = await AsyncStorage.getItem(CLE);
    etat = brut ? JSON.parse(brut) : etatParDefaut();
  } catch (e) {
    etat = etatParDefaut();
  }
  // Installations d'avant le journal : le debut est la plus ancienne donnee
  // connue (a defaut, aujourd'hui).
  if (!etat.debut) etat.debut = plusAncienneDate(etat) || dateDuJour();

  // Complete les champs manquants (robustesse si le schema evolue).
  const base = etatParDefaut();
  etat = {
    ...base,
    ...etat,
    jour: { ...base.jour, ...(etat.jour || {}) },
    jeu: { ...base.jeu, ...(etat.jeu || {}) },
  };

  const change = appliquerRollover(etat);
  if (change) {
    // Persiste immediatement l'archivage pour ne pas le reperdre.
    try { await AsyncStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) {}
  }
  return etat;
}

/** Sauvegarde l'etat complet. */
export async function sauvegarderEtat(etat) {
  try {
    await AsyncStorage.setItem(CLE, JSON.stringify(etat));
  } catch (e) {
    // Silencieux : une ecriture ratee ne doit pas casser l'UI. La prochaine
    // sauvegarde retentera.
  }
}

/** Efface tout (utile pour un bouton "reinitialiser" ou les tests). */
export async function effacerTout() {
  try { await AsyncStorage.removeItem(CLE); } catch (e) {}
}
