// Acces a la table de composition nutritionnelle CIQUAL 2020 (ANSES).
//
// Role : c'est LA source de verite nutritionnelle de l'app. L'IA n'a plus le
// droit d'inventer des calories ; elle identifie l'aliment et estime la
// portion, et c'est ce module qui fournit les valeurs reelles.
//
// Les donnees sont embarquees (data/ciqual.json, ~235 Ko) : aucune requete
// reseau, ca marche hors-ligne et instantanement.

import TABLE from "./data/ciqual.json";

// Le JSON est stocke en tableau de tableaux pour tenir en 235 Ko au lieu de
// ~700 Ko. On le rehydrate une seule fois au chargement du module.
//
// Les positions sont resolues depuis TABLE.champs plutot qu'ecrites en dur :
// si build-ciqual.js change l'ordre des colonnes un jour, le code suit au lieu
// de lire silencieusement les glucides a la place des lipides.
const col = (nom) => {
  const i = TABLE.champs.indexOf(nom);
  if (i < 0) throw new Error(`Colonne absente de data/ciqual.json : ${nom}`);
  return i;
};
const [C_CODE, C_NOM, C_GROUPE, C_KCAL, C_PROT, C_GLUC, C_LIP, C_SUCRES, C_FIBRES, C_SEL, C_CONF] =
  ["code", "nom", "groupe", "kcal", "prot", "gluc", "lip", "sucres", "fibres", "sel", "conf"].map(col);

const ALIMENTS = TABLE.aliments.map((l) => ({
  code: l[C_CODE],
  nom: l[C_NOM],
  groupe: l[C_GROUPE],
  kcal: l[C_KCAL],
  prot: l[C_PROT],
  gluc: l[C_GLUC],
  lip: l[C_LIP],
  sucres: l[C_SUCRES],
  fibres: l[C_FIBRES],
  sel: l[C_SEL],
  conf: l[C_CONF],
}));

const PAR_CODE = new Map(ALIMENTS.map((a) => [a.code, a]));

export const NB_ALIMENTS = ALIMENTS.length;
export const SOURCE = TABLE.source;

// --- Normalisation du texte ------------------------------------------------

// On n'utilise pas String.normalize("NFD") : le moteur JS de React Native
// (Hermes) ne le supporte pas partout, et ca ne gere de toute facon pas les
// ligatures ("oeuf"). Table explicite, donc predictible.
const ACCENTS = {
  à: "a", â: "a", ä: "a", á: "a", ã: "a", å: "a",
  ç: "c",
  è: "e", é: "e", ê: "e", ë: "e",
  ì: "i", í: "i", î: "i", ï: "i",
  ñ: "n",
  ò: "o", ó: "o", ô: "o", ö: "o", õ: "o",
  ù: "u", ú: "u", û: "u", ü: "u",
  ý: "y", ÿ: "y",
  œ: "oe", æ: "ae",
};

/** "Poêlée de légumes" -> "poelee de legumes" */
function sansAccents(texte) {
  let out = "";
  for (const c of texte.toLowerCase()) out += ACCENTS[c] || c;
  return out;
}

// Mots vides : tres frequents dans les libelles CIQUAL ("Boeuf, steak hache,
// a 5% MG, cru"), ils n'apportent aucun pouvoir discriminant.
const MOTS_VIDES = new Set([
  "a", "au", "aux", "de", "des", "du", "d", "en", "et", "l", "la", "le", "les",
  "ou", "sur", "un", "une", "pour", "par", "avec", "type", "sorte", "tout",
  "tous", "toute", "toutes", "sans", "precision", "non", "ni", "plus", "moins",
]);

/**
 * Decoupe un libelle en mots utiles.
 *
 * Chaque mot garde sa forme d'origine ET une racine desingularisee. Le
 * singulier approxime est necessaire (CIQUAL ecrit "Carottes" la ou l'IA dira
 * "carotte") mais il est ambigu : "pates" (les nouilles) et "pate" (la pate
 * feuilletee) donnent la meme racine. On conserve donc les deux formes pour
 * pouvoir privilegier une correspondance exacte a une correspondance de racine.
 */
function motsCles(texte) {
  return sansAccents(texte)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((m) => m.length > 1 && !MOTS_VIDES.has(m))
    .map((m) => ({
      brut: m,
      racine: m.length > 3 && m.endsWith("s") ? m.slice(0, -1) : m,
    }));
}

// --- Etat de cuisson -------------------------------------------------------

// C'est le facteur d'erreur le plus couteux de toute l'app : le riz cru est a
// 350 kcal/100 g, cuit a 145. Confondre les deux fausse le resultat d'un
// facteur 2,4. On detecte donc explicitement l'etat demande et on ecarte les
// fiches qui ne correspondent pas.
const MOTS_CUIT = [
  "cuit", "cuite", "cuits", "cuites", "cuisson", "roti", "rotie", "rotis",
  "roties", "grille", "grillee", "grilles", "grillees", "frit", "frite",
  "frites", "friteuse", "poele", "poelee", "saute", "sautee", "bouilli",
  "bouillie", "vapeur", "etuve", "etuvee", "braise", "braisee", "mijote",
  "mijotee", "confit", "confite", "pane", "panee", "gratine", "gratinee",
  "barbecue", "plancha", "four",
];
const MOTS_CRU = ["cru", "crue", "crus", "crues"];

function contientUnDe(mots, liste) {
  return mots.some((m) => liste.includes(m.brut));
}

// Index calcule une seule fois : pour chaque aliment, ses mots et son etat.
const INDEX = ALIMENTS.map((a) => {
  const mots = motsCles(a.nom);
  return {
    aliment: a,
    mots,
    estCuit: contientUnDe(mots, MOTS_CUIT),
    estCru: contientUnDe(mots, MOTS_CRU),
  };
});

// --- Recherche -------------------------------------------------------------

/**
 * Score de correspondance entre les mots demandes et un libelle CIQUAL.
 *
 * Deux idees guident la ponderation :
 *  - la position compte. Les libelles CIQUAL vont du general au particulier
 *    ("Poulet, blanc, sans peau, cru") : un mot trouve en tete designe
 *    l'aliment lui-meme, un mot trouve en fin n'est qu'un detail de preparation.
 *  - la brievete compte. A egalite, "Pomme, crue" est un meilleur choix que
 *    "Pomme, crue, variete Golden, avec peau" : plus generique, donc plus sur
 *    quand on ne sait pas de quelle variete il s'agit.
 */
function score(motsRecherches, entree, veutCuit, veutCru) {
  const { mots } = entree;
  if (mots.length === 0) return 0;

  let total = 0;
  let trouves = 0;

  for (const mot of motsRecherches) {
    let meilleur = 0;
    for (let i = 0; i < mots.length; i++) {
      const cible = mots[i];
      let base = 0;
      // La forme exacte prime sur la racine : sans ca, "pates" (nouilles)
      // matcherait "pate" (feuilletee) aussi bien que "pates alimentaires".
      if (cible.brut === mot.brut) base = 10;
      else if (cible.racine === mot.racine) base = 8;
      else if (cible.racine.startsWith(mot.racine) || mot.racine.startsWith(cible.racine)) base = 6;
      else if (mot.racine.length >= 5 && cible.racine.includes(mot.racine)) base = 3;
      if (base === 0) continue;
      // Poids de position : 1.0 pour le 1er mot, decroissant ensuite.
      const poids = 1 / (1 + i * 0.35);
      meilleur = Math.max(meilleur, base * poids);
    }
    if (meilleur > 0) trouves++;
    total += meilleur;
  }

  if (trouves === 0) return 0;

  // Coherence cru / cuit (voir MOTS_CUIT plus haut pour l'enjeu).
  if (veutCuit) {
    if (entree.estCru) total *= 0.35;
    else if (entree.estCuit) total *= 1.3;
  } else if (veutCru) {
    if (entree.estCuit) total *= 0.5;
    else if (entree.estCru) total *= 1.3;
  }

  // Bonus si TOUS les mots demandes sont presents : distingue nettement
  // "riz complet" d'une fiche "riz" generique quand on cherche le complet.
  if (trouves === motsRecherches.length) total *= 1.5;

  // Penalite de verbosite (douce) : favorise les fiches generiques.
  total *= 1 / (1 + Math.max(0, mots.length - motsRecherches.length) * 0.08);

  // Legere prime aux donnees les plus fiables (code de confiance ANSES).
  const prime = { A: 1.08, B: 1.04, C: 1.0, D: 0.97 }[entree.aliment.conf] || 1.0;
  return total * prime;
}

/**
 * Cherche les fiches CIQUAL correspondant a un nom d'aliment.
 * Renvoie les meilleures candidates, triees du plus probable au moins probable.
 */
export function rechercher(requete, limite = 8) {
  const mots = motsCles(requete || "");
  if (mots.length === 0) return [];

  const veutCuit = contientUnDe(mots, MOTS_CUIT);
  const veutCru = contientUnDe(mots, MOTS_CRU);

  const resultats = [];
  for (const entree of INDEX) {
    const s = score(mots, entree, veutCuit, veutCru);
    if (s > 0) resultats.push({ aliment: entree.aliment, score: s });
  }

  resultats.sort((a, b) => b.score - a.score);
  return resultats.slice(0, limite).map((r) => r.aliment);
}

/**
 * true si la fiche contient TOUS les mots demandes (forme exacte, racine ou
 * debut de mot) : la recherche a trouve l'aliment lui-meme, pas un voisin.
 */
export function correspondExacte(requete, aliment) {
  const mots = motsCles(requete || "");
  if (!aliment || mots.length === 0) return false;
  const cibles = motsCles(aliment.nom);
  return mots.every((m) =>
    cibles.some((c) => c.brut === m.brut || c.racine === m.racine ||
      c.racine.startsWith(m.racine) || m.racine.startsWith(c.racine))
  );
}

/** Distance d'edition (Levenshtein) entre deux mots courts. */
function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cour = [i];
    for (let j = 1; j <= b.length; j++) {
      cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prec = cour;
  }
  return prec[b.length];
}

/**
 * Recherche tolerante aux fautes de frappe ("choclat", "yaourth") : un mot
 * est retrouve s'il differe d'une lettre (deux pour les mots longs). Sert a la
 * recherche manuelle quand rechercher() ne trouve pas l'aliment exact ; la
 * recherche de l'analyse photo, elle, reste rechercher() tel quel.
 */
export function rechercherApprochant(requete, limite = 10) {
  const mots = motsCles(requete || "").filter((m) => m.brut.length >= 4);
  if (mots.length === 0) return [];
  const resultats = [];
  for (const entree of INDEX) {
    let total = 0;
    for (const mot of mots) {
      const tolere = mot.brut.length >= 7 ? 2 : 1;
      let meilleur = 0;
      entree.mots.forEach((cible, i) => {
        if (cible.brut.length < 3) return;
        const d = Math.min(distance(mot.brut, cible.brut), distance(mot.racine, cible.racine));
        if (d <= tolere) meilleur = Math.max(meilleur, (tolere + 1 - d) / (1 + i * 0.35));
      });
      total += meilleur;
    }
    if (total > 0) resultats.push({ aliment: entree.aliment, score: total / (1 + entree.mots.length * 0.05) });
  }
  resultats.sort((a, b) => b.score - a.score);
  return resultats.slice(0, limite).map((r) => r.aliment);
}

/** Nombre de mots demandes presents dans la fiche, fautes de frappe tolerees. */
export function couverture(requete, aliment) {
  const cibles = motsCles(aliment?.nom || "");
  return motsCles(requete || "").filter((m) =>
    cibles.some((c) => c.brut === m.brut || c.racine === m.racine ||
      c.racine.startsWith(m.racine) || m.racine.startsWith(c.racine) ||
      (m.brut.length >= 4 && c.brut.length >= 3 &&
        distance(m.brut, c.brut) <= (m.brut.length >= 7 ? 2 : 1)))
  ).length;
}

/** Recupere une fiche par son code CIQUAL. */
export function parCode(code) {
  return PAR_CODE.get(Number(code)) || null;
}

// --- Calcul nutritionnel ---------------------------------------------------

/**
 * Applique les valeurs CIQUAL (donnees pour 100 g) a une portion reelle.
 * C'est ici que se fait le remplacement des chiffres inventes par l'IA.
 */
export function calculer(aliment, grammes) {
  const g = Number(grammes) || 0;
  const f = g / 100;
  const val = (v) => (v == null ? null : Math.round(v * f * 10) / 10);
  return {
    grammes: g,
    kcal: Math.round((aliment.kcal || 0) * f),
    prot: val(aliment.prot),
    gluc: val(aliment.gluc),
    lip: val(aliment.lip),
    sucres: val(aliment.sucres),
    fibres: val(aliment.fibres),
    sel: val(aliment.sel),
  };
}

/** Somme d'une liste de resultats de calculer(). */
export function totaliser(portions) {
  const somme = { kcal: 0, prot: 0, gluc: 0, lip: 0, sucres: 0, fibres: 0, sel: 0 };
  for (const p of portions) {
    for (const cle of Object.keys(somme)) somme[cle] += p[cle] || 0;
  }
  for (const cle of Object.keys(somme)) somme[cle] = Math.round(somme[cle] * 10) / 10;
  somme.kcal = Math.round(somme.kcal);
  return somme;
}
