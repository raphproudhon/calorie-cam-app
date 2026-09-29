// Journal : tous les jours depuis le premier lancement de l'app, du plus recent
// au plus ancien — y compris ceux ou l'app n'a pas servi.
//
// Sources (voir le schema dans stockage.js) :
//   - etat.debut      : date du premier lancement ;
//   - etat.historique : jours termines ({ date, consomme, sport, objectif, repas? }) ;
//   - etat.jour       : la journee en cours ;
//   - etat.poids      : pesees ({ date, valeur }).
//
// Le verdict d'une journee reprend la regle du jeu (jourReussi) : on ne felicite
// jamais une journee ou l'on a trop peu mange (garde-fou sante).

import { jourReussi } from "./jeu";

// Au-dela, on s'arrete : garde-fou si une date de debut est aberrante.
const MAX_JOURS = 3660;

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// --- Dates AAAA-MM-JJ (heure locale) ------------------------------------------

function versDate(s) {
  const [a, m, j] = s.split("-").map(Number);
  return new Date(a, m - 1, j);
}

function versTexte(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function veille(s) {
  const d = versDate(s);
  d.setDate(d.getDate() - 1);
  return versTexte(d);
}

const dateValide = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** « lundi 28 septembre » (+ l'annee si ce n'est pas celle de reference). */
export function dateLisible(s, anneeRef) {
  const d = versDate(s);
  const base = `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
  return anneeRef && d.getFullYear() !== anneeRef ? `${base} ${d.getFullYear()}` : base;
}

/**
 * Plus ancienne date connue de l'etat (historique, pesees, journee en cours) :
 * sert a retrouver le debut pour les installations d'avant le journal.
 */
export function plusAncienneDate(etat) {
  const dates = [
    ...(etat.historique || []).map((h) => h.date),
    ...(etat.poids || []).map((p) => p.date),
    etat.jour?.date,
  ].filter(dateValide);
  return dates.length ? dates.sort()[0] : null;
}

// --- Construction du journal ------------------------------------------------

/**
 * Verdict d'une journee terminee : "cible" (dans la fourchette du jeu),
 * "dessus" (au-dessus du budget) ou "dessous" (trop peu mange).
 */
export function verdictJour(j) {
  if (jourReussi(j, j.objectif)) return "cible";
  const budget = (j.objectif || 0) + (j.sport || 0);
  return (j.consomme || 0) > budget ? "dessus" : "dessous";
}

/**
 * Un element par jour, de aujourd'hui (inclus) a etat.debut (inclus), du plus
 * recent au plus ancien :
 *   { date, type: "aujourdhui" | "suivi" | "vide", consomme, sport, objectif,
 *     budget, reste, verdict, poids, repas }
 */
export function joursDuJournal(etat, aujourdhui) {
  const fin = aujourdhui;
  let debut = dateValide(etat.debut) ? etat.debut : plusAncienneDate(etat) || fin;
  if (debut > fin) debut = fin;

  const archives = new Map((etat.historique || []).map((h) => [h.date, h]));
  // Derniere pesee de chaque jour.
  const pesees = new Map();
  for (const p of etat.poids || []) if (dateValide(p.date)) pesees.set(p.date, p.valeur);

  const jours = [];
  for (let d = fin, n = 0; d >= debut && n < MAX_JOURS; d = veille(d), n++) {
    const poids = pesees.has(d) ? pesees.get(d) : null;

    let brut = null;
    let type = "vide";
    if (d === fin && etat.jour?.date === fin) {
      brut = { ...etat.jour, objectif: etat.objectif || 0 };
      type = "aujourdhui";
    } else if (archives.has(d)) {
      brut = archives.get(d);
      type = "suivi";
    }

    if (!brut) {
      jours.push({ date: d, type, poids, repas: [] });
      continue;
    }
    const consomme = Math.round(brut.consomme || 0);
    const sport = parseInt(brut.sport || "0", 10) || 0;
    const objectif = brut.objectif || 0;
    const budget = objectif + sport;
    jours.push({
      date: d,
      type,
      consomme,
      sport,
      objectif,
      budget,
      reste: budget - consomme,
      // Pas de verdict pour la journee en cours : elle n'est pas finie.
      verdict: type === "suivi" ? verdictJour({ consomme, sport, objectif }) : null,
      poids,
      repas: brut.repas || [],
    });
  }
  return jours;
}

/**
 * Regroupe les jours vides consecutifs en une seule ligne
 * ({ type: "trou", du, au, nb }) : le journal reste lisible meme apres une
 * longue pause.
 */
export function grouperJoursVides(jours) {
  const lignes = [];
  for (const j of jours) {
    const prec = lignes[lignes.length - 1];
    if (j.type === "vide" && j.poids == null) {
      if (prec && prec.type === "trou") {
        prec.du = j.date; // on descend dans le temps : le plus ancien a la fin
        prec.nb += 1;
      } else {
        lignes.push({ type: "trou", au: j.date, du: j.date, nb: 1 });
      }
    } else {
      lignes.push(j);
    }
  }
  return lignes;
}

/** Chiffres du haut du journal. */
export function resumeJournal(jours) {
  const termines = jours.filter((j) => j.type === "suivi");
  return {
    total: jours.length,
    suivis: termines.length + jours.filter((j) => j.type === "aujourdhui" && j.consomme > 0).length,
    dansLaCible: termines.filter((j) => j.verdict === "cible").length,
    debut: jours.length ? jours[jours.length - 1].date : null,
  };
}
