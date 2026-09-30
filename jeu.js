// Systeme de progression ludique : XP, niveaux, badges, etapes du personnage.
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
  MACRO: 10,        // + bonus par macro (proteines, glucides, lipides) dans son quota
};

// Fourchette "cible atteinte" pour une journee, en fraction de l'objectif de
// base. Borne basse >0 pour NE PAS recompenser la sous-alimentation.
const CIBLE_MIN = 0.8;  // au moins 80 % de l'objectif de base mange
const CIBLE_MAX = 1.1;  // au plus 110 % du budget (objectif + sport)

// --- Quotas de macros ------------------------------------------------------

// Une macro est « respectee » si la journee en contient entre 80 % et 120 % du
// quota. Borne basse pour NE PAS recompenser la sous-alimentation (meme regle
// que les calories), borne haute pour ne pas recompenser l'exces.
const MACRO_MIN = 0.8;
const MACRO_MAX = 1.2;

/** Les trois macros suivies : cle dans jour.macros, cle du quota, libelle. */
export const MACROS = [
  { cle: "prot", quota: "proteines", nom: "Protéines" },
  { cle: "gluc", quota: "glucides", nom: "Glucides" },
  { cle: "lip", quota: "lipides", nom: "Lipides" },
];

/** Zone validee d'une macro, en g : { min, max } (quota en g). */
export function zoneMacro(quota) {
  return { min: Math.round((quota || 0) * MACRO_MIN), max: Math.round((quota || 0) * MACRO_MAX) };
}

/** Cles (prot, gluc, lip) des macros dont la quantite du jour est dans la zone. */
export function macrosRespectees(macros, quotas) {
  if (!macros || !quotas) return [];
  return MACROS.filter(({ cle, quota }) => {
    const q = quotas[quota];
    if (!(q > 0)) return false;
    const { min, max } = zoneMacro(q);
    const v = macros[cle] || 0;
    return v >= min && v <= max;
  }).map((m) => m.cle);
}

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

/**
 * Zone « journee validee » en kcal : de 80 % de l'objectif de base (jamais de
 * recompense pour une sous-alimentation) a 110 % du budget (objectif + sport).
 * Sert au jeu (jourReussi) et a l'affichage du Bilan : une seule regle.
 */
export function zoneCible(objectif, sport = 0) {
  const budget = (objectif || 0) + (parseInt(sport || 0, 10) || 0);
  return { min: Math.round((objectif || 0) * CIBLE_MIN), max: Math.round(budget * CIBLE_MAX) };
}

/** Une journee archivee est-elle "dans la cible" (ni trop peu, ni trop) ? */
export function jourReussi(jour, objectif) {
  const { min, max } = zoneCible(objectif, jour.sport);
  const c = jour.consomme || 0;
  return c >= min && c <= max;
}

/**
 * Recompense une journee qui vient d'etre archivee (bascule de minuit).
 * Met a jour xp, serie, jours reussis et badges. Renvoie un NOUVEAU jeu.
 * @param jour {date, consomme, sport, objectif, macros?, quotas?}
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

  // Bonus macros : un par macro restee dans son quota (jour.quotas = quotas
  // en vigueur ce jour-la, fixes a l'archivage).
  const respectees = macrosRespectees(jour.macros, jour.quotas).length;
  j.xp += respectees * XP.MACRO;
  j.macrosRespectees = (j.macrosRespectees || 0) + respectees;

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

// --- Personnage : 20 etapes par palier de niveau ----------------------------
// Deux persos au choix (fixe a l'onboarding, definitif) : "humain" (le
// Necromancien) et "chat" (le Chat celeste). Meme progression pour les deux :
// les 10 paliers de couleur + 10 intercales. Le debut va vite (5 etapes la
// premiere semaine), la fin prend 2-3 ans (voir PERSO.md).
export const PALIERS_PERSO = [1, 2, 3, 4, 5, 6, 7, 9, 11, 13, 15, 18, 21, 24, 27, 31, 35, 40, 45, 50];
export const NB_ETAPES = PALIERS_PERSO.length;

export const PERSOS = {
  humain: {
    nom: "Le Nécromancien",
    etapes: [
      "L'inconnu", "L'ombre qui bouge", "L'éveil", "Le blouson", "Premier appel",
      "Le long manteau", "Le harnais d'os", "Les mains de l'ombre", "L'épaulière crâne", "Le capuchon",
      "La faux", "La cape déchirée", "Les gantelets", "Les flammes spectrales", "La double faux",
      "L'armure gravée", "La mèche blonde", "La faux des âmes", "La couronne d'os", "Le Souverain des Tombes",
    ],
  },
  chat: {
    nom: "Le Chat céleste",
    etapes: [
      "Le chaton", "Le grelot", "L'écharpe", "Première étincelle", "La petite cape",
      "Le harnais", "La flamme de la queue", "Le plastron", "Les runes-pattes", "Les yeux ambre",
      "La deuxième queue", "Les anneaux d'oreilles", "Les pattes de feu", "Les feux follets", "Deux queues de flamme",
      "Trois queues", "Les petites ailes", "La couronne de flammes", "Le halo", "Le Gardien céleste",
    ],
  },
};

/** Etape du personnage (0..19) atteinte a un niveau donne. */
export function etapePersonnage(niveau) {
  let e = 0;
  for (let i = 0; i < PALIERS_PERSO.length; i++) {
    if (niveau >= PALIERS_PERSO[i]) e = i;
  }
  return e;
}

/**
 * Montee de niveau a feter : compare le dernier niveau montre a l'utilisateur
 * (etat.niveauVu) au niveau actuel. Renvoie null s'il n'y a rien a feter
 * (niveau inchange ou en baisse, ou niveauVu inconnu), sinon
 * { avant, apres, etapeAvant, etapeApres, evolution } — evolution = le perso
 * change d'apparence (un palier de PALIERS_PERSO a ete franchi).
 */
export function monteeNiveau(niveauVu, niveau) {
  if (niveauVu == null || !(niveau > niveauVu)) return null;
  const etapeAvant = etapePersonnage(niveauVu);
  const etapeApres = etapePersonnage(niveau);
  return { avant: niveauVu, apres: niveau, etapeAvant, etapeApres, evolution: etapeApres !== etapeAvant };
}

/**
 * Humeur du perso dans le Bilan, d'apres le consomme du jour et la zone
 * validee (zoneCible) :
 *   "attente" : rien mange pour l'instant ;
 *   "faim"    : sous la zone — normal en cours de journee, jamais felicite ;
 *   "content" : dans la zone (journee validee) ;
 *   "repu"    : au-dela de la zone.
 * Garde-fou sante : manger peu ne rend JAMAIS le perso content.
 */
export function humeurBilan(consomme, zone) {
  if (!(consomme > 0)) return "attente";
  if (consomme < zone.min) return "faim";
  if (consomme <= zone.max) return "content";
  return "repu";
}

// --- Theme de l'app, propre a chaque perso -----------------------------------
// Le fond melange l'accent a une base tres sombre : il reste lisible tout en
// tirant legerement vers la couleur du theme.
function melangeHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const mix = (sh) => Math.round(((pa >> sh) & 255) * t + ((pb >> sh) & 255) * (1 - t));
  return "#" + [mix(16), mix(8), mix(0)].map((v) => v.toString(16).padStart(2, "0")).join("");
}
const fondDe = (accent) => melangeHex(accent, "#15131B", 0.16);

// Necromancien : la couleur suit ses 20 etapes et reprend son design (voir
// PERSO.md) — le brun de ses yeux au debut, puis le vert de sa flamme
// spectrale qui s'intensifie avec ses yeux, et l'or sombre des etapes finales.
// Teintes un peu assombries pour garder le texte blanc des boutons lisible
// (contraste >= 3 avec le blanc).
const ACCENT_NECRO = [
  { jusqua: 2,  accent: "#9A6B45" }, // 1-2   brun chaud : yeux marron
  { jusqua: 5,  accent: "#5E8C6A" }, // 3-5   vert-de-gris : reflet vert
  { jusqua: 8,  accent: "#3A8A55" }, // 6-8   vert noisette : legere lueur
  { jusqua: 14, accent: "#1F9D55" }, // 9-14  emeraude : yeux emeraude
  { jusqua: 18, accent: "#10A35A" }, // 15-18 emeraude ardent
  { jusqua: 20, accent: "#A8841C" }, // 19-20 or sombre
];
const EMERAUDE = "#10A35A";

/** Accent du Necromancien a une etape (1..20). */
export function accentNecromancien(etape) {
  return (ACCENT_NECRO.find((p) => etape <= p.jusqua) || ACCENT_NECRO[ACCENT_NECRO.length - 1]).accent;
}

// Chat celeste : theme clair et doux — blanc, rose pale, vert pale. Les
// boutons sont rose pale (texte fonce dessus), la barre d'XP vert pale ; les
// textes colores prennent un rose plus soutenu, lisible sur fond blanc.
const THEME_CHAT = {
  clair: true,
  accent: "#F7C6D4",      // rose pale : boutons, onglet actif
  accentTexte: "#C2567A", // rose soutenu : textes colores
  xp: "#9ED9AE",          // vert pale : barre d'XP
  fond: "#FFF9FB",        // blanc a peine rose
};

/**
 * Theme de l'app pour un perso et un niveau donnes :
 * { clair, accent, accentTexte, xp, fond }.
 */
export function themePerso(perso, niveau) {
  if (perso === "chat") return THEME_CHAT;
  const etape = etapePersonnage(niveau) + 1; // 1..20
  const accent = accentNecromancien(etape);
  // Etapes d'or : le fond garde la teinte emeraude, l'or ne sert qu'a l'accent.
  return {
    clair: false,
    accent,
    accentTexte: accent,
    xp: accent,
    fond: fondDe(etape >= 19 ? EMERAUDE : accent),
  };
}
