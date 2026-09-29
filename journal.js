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

// --- Calendrier (vues Jour / Semaine / Mois / Annee) ------------------------------

export const NIVEAUX_CALENDRIER = ["annee", "mois", "semaine", "jour"]; // du plus large au plus fin
export const JOURS_COURTS = ["L", "M", "M", "J", "V", "S", "D"]; // semaine commencant lundi
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** Date AAAA-MM-JJ decalee de n jours. */
export function ajouterJours(s, n) {
  const d = versDate(s);
  d.setDate(d.getDate() + n);
  return versTexte(d);
}

/** Date decalee de n mois (jour ramene a la fin du mois si besoin : 31 -> 30). */
export function ajouterMois(s, n) {
  const d = versDate(s);
  const jour = d.getDate();
  const cible = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const dernier = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate();
  cible.setDate(Math.min(jour, dernier));
  return versTexte(cible);
}

/** Lundi de la semaine d'une date. */
export function lundiDe(s) {
  const d = versDate(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return versTexte(d);
}

/** Les 7 dates de la semaine (lundi -> dimanche) contenant s. */
export function semaineDe(s) {
  const lundi = lundiDe(s);
  return Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));
}

/**
 * Grille d'un mois (mois de 0 a 11) : semaines de 7 cases, lundi en premier ;
 * null pour les cases hors du mois.
 */
export function grilleMois(annee, mois) {
  const premier = new Date(annee, mois, 1);
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  const decalage = (premier.getDay() + 6) % 7;
  const cases = Array(decalage).fill(null);
  for (let j = 1; j <= nbJours; j++) cases.push(versTexte(new Date(annee, mois, j)));
  while (cases.length % 7) cases.push(null);
  const semaines = [];
  for (let i = 0; i < cases.length; i += 7) semaines.push(cases.slice(i, i + 7));
  return semaines;
}

/** Titre de la periode affichee, selon le niveau de zoom. */
export function titrePeriode(niveau, s) {
  const d = versDate(s);
  if (niveau === "annee") return String(d.getFullYear());
  if (niveau === "mois") return `${MOIS[d.getMonth()].charAt(0).toUpperCase()}${MOIS[d.getMonth()].slice(1)} ${d.getFullYear()}`;
  if (niveau === "semaine") {
    const [l, dim] = [versDate(lundiDe(s)), versDate(ajouterJours(lundiDe(s), 6))];
    return `${l.getDate()} ${MOIS_COURTS[l.getMonth()]} – ${dim.getDate()} ${MOIS_COURTS[dim.getMonth()]} ${dim.getFullYear()}`;
  }
  const t = dateLisible(s);
  return `${t.charAt(0).toUpperCase()}${t.slice(1)} ${d.getFullYear()}`;
}

/** Nom du mois (0..11), avec majuscule. */
export function nomMois(mois) {
  return MOIS[mois].charAt(0).toUpperCase() + MOIS[mois].slice(1);
}

/** Periode suivante (sens = +1) ou precedente (-1) au niveau donne. */
export function decalerPeriode(niveau, s, sens) {
  if (niveau === "jour") return ajouterJours(s, sens);
  if (niveau === "semaine") return ajouterJours(s, 7 * sens);
  if (niveau === "mois") return ajouterMois(s, sens);
  return ajouterMois(s, 12 * sens);
}

/** Niveau voisin : +1 = zoom avant (vers le jour), -1 = zoom arriere (vers l'annee). */
export function niveauVoisin(niveau, sens) {
  const i = NIVEAUX_CALENDRIER.indexOf(niveau);
  return NIVEAUX_CALENDRIER[Math.max(0, Math.min(NIVEAUX_CALENDRIER.length - 1, i + sens))];
}
