// Systeme de progression ludique : XP, niveaux, badges, evolution du personnage.
//
// GARDE-FOU DE SANTE (voir aussi besoins.js) : on recompense des COMPORTEMENTS
// sains, jamais "manger le moins possible". Une journee ne rapporte le bonus
// "cible" que si le consomme reste dans une fourchette raisonnable autour de
// l'objectif. Manger tres en-dessous ne rapporte donc PAS plus — au contraire,
// ca ne valide pas la cible. Le suivi du poids recompense l'action de se peser,
// pas la valeur affichee.

// --- Valeurs d'XP ----------------------------------------------------------

export const XP = {
  JOUR_LOGGE: 20,   // une journee terminee avec au moins un repas enregistre
  CIBLE: 30,        // + bonus si cette journee est restee dans la cible
  PESEE: 15,        // enregistrer son poids (1x/jour max)
  PALIER_KG: 40,    // chaque kg parcouru dans le sens de l'objectif
};

// Fourchette "cible atteinte" pour une journee, en fraction de l'objectif de
// base. Borne basse >0 pour NE PAS recompenser la sous-alimentation.
const CIBLE_MIN = 0.8;  // au moins 80 % de l'objectif de base mange
const CIBLE_MAX = 1.1;  // au plus 110 % du budget (objectif + sport)

// --- Niveaux ---------------------------------------------------------------

// XP cumulee necessaire pour ATTEINDRE le niveau L. Courbe douce puis
// croissante : L1=0, L2=50, L3=150, L4=300, L5=500, L6=750...
function seuilNiveau(L) {
  return 25 * L * (L - 1);
}

/** Niveau (>=1) et progression vers le suivant, a partir de l'XP totale. */
export function niveauDepuisXp(xp) {
  const x = Math.max(0, xp || 0);
  let L = 1;
  while (seuilNiveau(L + 1) <= x) L++;
  const bas = seuilNiveau(L);
  const haut = seuilNiveau(L + 1);
  return {
    niveau: L,
    xpDansNiveau: x - bas,
    xpNiveau: haut - bas,
    progression: (x - bas) / (haut - bas), // 0..1 pour la barre
  };
}

// --- Etapes du personnage (guerrier) ---------------------------------------

// 10 etapes debloquees selon le niveau (une image par etape, voir assets/hero).
// Les paliers montent vite au debut (motivant) puis s'espacent (aspirationnel).
const PALIERS_PERSO = [1, 2, 4, 6, 9, 13, 18, 24, 31, 40];
export const NB_ETAPES = PALIERS_PERSO.length;

export const NOMS_ETAPES = [
  "Novice",
  "Éveillé",
  "Traqueur",
  "Chevalier d'ombre",
  "Spectre",
  "Seigneur d'ombre",
  "Revenant",
  "Archonte",
  "Souverain",
  "Monarque des ombres",
];

/** Index d'etape (0..9) du personnage pour un niveau donne. */
export function etapePersonnage(niveau) {
  let e = 0;
  for (let i = 0; i < PALIERS_PERSO.length; i++) {
    if (niveau >= PALIERS_PERSO[i]) e = i;
  }
  return e;
}

// --- Badges ----------------------------------------------------------------

// Chaque badge : id, libelle, et predicat sur l'etat de jeu (+ niveau).
// Une fois debloque, un badge reste acquis (stocke dans jeu.badges).
export const BADGES = [
  { id: "premiere_pesee", libelle: "Première pesée", emoji: "⚖️", test: (j) => j.pesees >= 1 },
  { id: "streak_3", libelle: "3 jours d'affilée", emoji: "🔥", test: (j) => j.streakMax >= 3 },
  { id: "streak_7", libelle: "7 jours d'affilée", emoji: "🔥", test: (j) => j.streakMax >= 7 },
  { id: "streak_30", libelle: "30 jours d'affilée", emoji: "🏵️", test: (j) => j.streakMax >= 30 },
  { id: "cible_10", libelle: "10 jours dans la cible", emoji: "🎯", test: (j) => j.joursReussis >= 10 },
  { id: "niveau_5", libelle: "Niveau 5", emoji: "⭐", test: (j, niv) => niv >= 5 },
  { id: "niveau_10", libelle: "Niveau 10", emoji: "🌟", test: (j, niv) => niv >= 10 },
];

/** Renvoie la liste d'ids de badges nouvellement debloques (non deja acquis). */
export function badgesDebloques(jeu) {
  const niv = niveauDepuisXp(jeu.xp).niveau;
  const acquis = new Set(jeu.badges || []);
  return BADGES.filter((b) => !acquis.has(b.id) && b.test(jeu, niv)).map((b) => b.id);
}

// --- Etat de jeu par defaut ------------------------------------------------

export function jeuParDefaut() {
  return {
    xp: 0,
    streak: 0,           // jours consecutifs en cours
    streakMax: 0,        // record (pour les badges)
    dernierJour: null,   // date du dernier jour recompense (AAAA-MM-JJ)
    joursReussis: 0,     // total de journees "dans la cible"
    pesees: 0,           // nombre de pesees enregistrees
    dernierePesee: null, // date de la derniere pesee (1x/jour)
    poidsReference: null,// 1er poids enregistre (pour les paliers)
    paliersPoids: 0,     // nombre de kg-paliers deja recompenses
    badges: [],
  };
}

// --- Attribution d'XP ------------------------------------------------------

/** Nombre de jours entiers entre deux dates AAAA-MM-JJ (b - a). */
function diffJours(a, b) {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db - da) / 86400000);
}

/** Une journee archivee est-elle "dans la cible" (ni trop peu, ni trop) ? */
export function jourReussi(jour, objectif) {
  const budget = (objectif || 0) + (parseInt(jour.sport || 0, 10) || 0);
  const c = jour.consomme || 0;
  return c >= objectif * CIBLE_MIN && c <= budget * CIBLE_MAX;
}

/**
 * Recompense une journee qui vient d'etre archivee (bascule de minuit).
 * Met a jour xp, serie, jours reussis et badges. Renvoie un NOUVEAU jeu.
 * @param jour {date, consomme, sport, objectif}
 */
export function recompenserJourArchive(jeu, jour) {
  const j = { ...jeu, badges: [...(jeu.badges || [])] };

  // Serie : +1 si la journee suit directement la derniere recompensee, sinon
  // la serie repart a 1.
  if (j.dernierJour && diffJours(j.dernierJour, jour.date) === 1) {
    j.streak = (j.streak || 0) + 1;
  } else {
    j.streak = 1;
  }
  j.streakMax = Math.max(j.streakMax || 0, j.streak);
  j.dernierJour = jour.date;

  j.xp += XP.JOUR_LOGGE;

  if (jourReussi(jour, jour.objectif)) {
    j.xp += XP.CIBLE;
    j.joursReussis = (j.joursReussis || 0) + 1;
  }

  for (const id of badgesDebloques(j)) j.badges.push(id);
  return j;
}

/** Ajoute (ou retire) de l'XP et recalcule les badges. Utilise par le bouton
 *  de test en mode developpement pour voir le personnage evoluer. */
export function ajouterXp(jeu, montant) {
  const j = { ...jeu, xp: Math.max(0, (jeu.xp || 0) + montant), badges: [...(jeu.badges || [])] };
  for (const id of badgesDebloques(j)) j.badges.push(id);
  return j;
}

/**
 * Recompense l'enregistrement d'un poids : XP de suivi (1x/jour) + paliers de
 * kg parcourus dans le sens de l'objectif (perte -> baisse, prise -> hausse).
 * @param entree {valeur, date}
 * @param but "perte" | "prise" | "maintien"
 */
export function recompenserPesee(jeu, entree, but) {
  const j = { ...jeu, badges: [...(jeu.badges || [])] };
  j.pesees = (j.pesees || 0) + 1;

  if (j.poidsReference == null) j.poidsReference = entree.valeur;

  // XP de suivi, au plus une fois par jour.
  if (j.dernierePesee !== entree.date) {
    j.xp += XP.PESEE;
    j.dernierePesee = entree.date;
  }

  // Paliers : mouvement (en kg) dans le bon sens depuis le poids de reference.
  if (but === "perte" || but === "prise") {
    const mouvement =
      but === "perte" ? j.poidsReference - entree.valeur : entree.valeur - j.poidsReference;
    const paliers = Math.max(0, Math.floor(mouvement));
    if (paliers > j.paliersPoids) {
      j.xp += (paliers - j.paliersPoids) * XP.PALIER_KG;
      j.paliersPoids = paliers;
    }
  }

  for (const id of badgesDebloques(j)) j.badges.push(id);
  return j;
}
