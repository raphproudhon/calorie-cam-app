// Indice de ballonnement : general (familles d'aliments connues) + personnel
// (ce que l'utilisateur signale).
//
// 1. Indice general d'un repas : une TABLE ECRITE A LA MAIN (REGLES) repere
//    dans le nom des aliments les familles connues pour ballonner — celles
//    riches en FODMAP (legumineuses, alliacees, lactose, polyols, certains
//    fruits), les cruciferes, les boissons gazeuses — plus les fibres et le
//    gras du repas (valeurs Ciqual / Open Food Facts). L'IA n'y est pour rien :
//    elle identifie les aliments, comme pour les calories, mais ne donne
//    aucun indice (meme regle que « l'IA n'invente aucune valeur »).
//
// 2. Indice personnel : l'utilisateur signale « je me sens ballonne »
//    (etat.ventre). Un repas est « suivi » d'un ballonnement si un signalement
//    tombe dans les 6 h qui suivent, le meme jour. Un aliment (ou une famille)
//    devient « suspect » quand il est suivi nettement plus souvent que la
//    moyenne des repas, sur assez de repas pour que ce ne soit pas un hasard.
//
// Purement indicatif : le ballonnement varie beaucoup d'une personne a
// l'autre. L'interface le dit, et renvoie vers un medecin s'il est frequent.

/** minuscules, sans accents ni ponctuation superflue. */
export function normaliser(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Familles connues. motif : regexp sur le nom normalise ; sauf : noms a
// ecarter (faux amis) ; poids : 1 (leger) a 3 (fort), pour 100 g environ.
export const REGLES = [
  {
    id: "legumineuses",
    libelle: "légumineuse",
    raison: "fibres fermentescibles (GOS)",
    poids: 3,
    motif: /\b(lentilles?|pois chiches?|haricots? (rouges?|blancs?|coco|noirs?|secs?|de lima|mungo|azuki|borlotti|tarbais|lingots?)|flageolets?|feves?|pois casses?|houmous|hoummos|falafels?|dal|dahl|soja en grains?)\b/,
  },
  {
    id: "cruciferes",
    libelle: "chou",
    raison: "crucifère, fermente dans l'intestin",
    poids: 2,
    motif: /\b(choux?|chou-fleur|choux-fleurs|brocolis?|choucroute|chou-rave|kale|navets?|radis)\b/,
    sauf: /\b(chou a la creme|choux a la creme|chouquettes?|pate a choux|chabichou)\b/,
  },
  {
    id: "alliacees",
    libelle: "oignon / ail",
    raison: "riche en fructanes",
    poids: 2,
    motif: /\b(oignons?|ail|echalotes?|poireaux?)\b/,
  },
  {
    id: "lactose",
    libelle: "produit laitier",
    raison: "lactose",
    poids: 2,
    motif: /\b(lait|laits|fromage blanc|faisselle|petits? suisses?|creme glacee|glaces?|creme dessert|lait concentre|milk-shake|milkshake|yaourts?|yoghourts?|yogourts?)\b/,
    sauf: /\b(lait de (coco|soja|riz|amande|avoine|noisette)|sans lactose|delactose|reduite en lactose|pain au lait|au lait|(a|au) la creme)\b/,
  },
  {
    id: "gazeux",
    libelle: "boisson gazeuse",
    raison: "apport direct de gaz",
    poids: 2,
    motif: /\b(gazeuses?|sodas?|colas?|coca|limonades?|bieres?|petillantes?|champagnes?|cidres?|tonic)\b/,
    sauf: /\bnon (gazeuses?|petillantes?)\b/,
  },
  {
    id: "polyols",
    libelle: "édulcorant",
    raison: "polyols (sorbitol, maltitol…)",
    poids: 2,
    motif: /\b(sorbitol|maltitol|xylitol|mannitol|isomalt|chewing-gums?|gommes? a macher|bonbons? sans sucres?|sans sucres?,? avec edulcorants)\b/,
  },
  {
    id: "fruits",
    libelle: "fruit",
    raison: "riche en fructose ou en polyols",
    poids: 1,
    motif: /\b(pommes?|poires?|pasteques?|mangues?|cerises?|pruneaux?|prunes?|abricots?|peches?|nectarines?|mures?|figues?|dattes?|jus de pomme)\b/,
    sauf: /\b(pommes? de terre|poireaux?|huile|tomates? cerises?|lieu de peche|sirop|brocoli a pomme)\b/,
  },
  {
    id: "fructanes",
    libelle: "légume à fructanes",
    raison: "fructanes ou polyols",
    poids: 1,
    motif: /\b(artichauts?|topinambours?|champignons?|asperges?|salsifis)\b/,
  },
];

/** Familles (REGLES) reconnues dans un nom d'aliment. */
export function famillesAliment(nom) {
  const n = normaliser(nom);
  return REGLES.filter((r) => r.motif.test(n) && !(r.sauf && r.sauf.test(n)));
}

// Petite portion (une gousse d'ail, un nuage de lait) : compte moins ; grosse
// portion : un peu plus.
function facteurQuantite(grammes) {
  const g = Number(grammes) || 0;
  if (g <= 0) return 1; // quantite inconnue : on compte une portion normale
  return Math.min(1.5, Math.max(0.3, g / 100));
}

export const NIVEAUX = {
  faible: { libelle: "Faible", emoji: "🟢" },
  moyen: { libelle: "Moyen", emoji: "🟠" },
  eleve: { libelle: "Élevé", emoji: "🔴" },
};

/**
 * Indice general d'un repas.
 * @param aliments [{ nom, grammes }]
 * @param totaux   { fibres, lip } du repas (g) — optionnel
 * @returns { niveau: "faible"|"moyen"|"eleve", score, causes: [{ nom, raison }] }
 */
export function indiceRepas(aliments, totaux = {}) {
  let score = 0;
  const causes = [];
  for (const a of aliments || []) {
    const familles = famillesAliment(a.nom);
    if (!familles.length) continue;
    // Une seule famille par aliment (la plus forte) : « lait de vache
    // gazeux » ne compte pas deux fois.
    const r = familles.reduce((m, f) => (f.poids > m.poids ? f : m));
    score += r.poids * facteurQuantite(a.grammes);
    causes.push({ nom: nomCourt(a.nom), raison: `${r.libelle} : ${r.raison}` });
  }
  const fibres = totaux.fibres || 0;
  if (fibres >= 12) {
    score += fibres >= 20 ? 2 : 1;
    causes.push({ nom: `${Math.round(fibres)} g de fibres`, raison: "beaucoup de fibres d'un coup" });
  }
  if ((totaux.lip || 0) >= 40) {
    score += 1;
    causes.push({ nom: `${Math.round(totaux.lip)} g de lipides`, raison: "repas très gras, digestion lente" });
  }
  score = Math.round(score * 10) / 10;
  const niveau = score >= 4 ? "eleve" : score >= 2 ? "moyen" : "faible";
  return { niveau, score, causes };
}

// --- Indice personnel --------------------------------------------------------

const MOTS_VIDES = new Set(["de", "du", "des", "la", "le", "les", "au", "aux", "a", "en", "et", "ou", "nature", "l", "d"]);

/** Nom lisible et court : « Pois chiche, bouilli/cuit a l'eau » -> « Pois chiche ». */
export function nomCourt(nom) {
  const t = String(nom || "").split(/,| — | \(/)[0].trim();
  return t || String(nom || "");
}

/**
 * Cle d'un aliment pour les statistiques personnelles : les deux premiers mots
 * significatifs du nom court, pour regrouper « Fromage blanc nature, 0% MG » et
 * « Fromage blanc nature, 3% MG » sous « fromage blanc ».
 */
export function cleAliment(nom) {
  const mots = normaliser(nomCourt(nom))
    .split(/[^a-z0-9-]+/)
    .filter((m) => m && !MOTS_VIDES.has(m));
  return mots.slice(0, 2).join(" ");
}

/**
 * Ce qu'on garde d'un repas pour l'indice personnel : aliments (cle + nom
 * court) et familles reconnues.
 */
export function empreinteRepas(aliments) {
  const vus = new Map();
  const familles = new Set();
  for (const a of aliments || []) {
    const cle = cleAliment(a.nom);
    if (cle && !vus.has(cle)) vus.set(cle, nomCourt(a.nom));
    for (const f of famillesAliment(a.nom)) familles.add(f.id);
  }
  return {
    aliments: [...vus].map(([cle, nom]) => ({ cle, nom })),
    familles: [...familles],
  };
}

const minutes = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};
export const FENETRE_MIN = 6 * 60; // un signalement compte pour les repas des 6 h precedentes

/** Ce repas (date, heure) est-il suivi d'un signalement dans la fenetre ? */
function estSuivi(date, heure, signalements) {
  const t = minutes(heure);
  if (t == null) return false;
  return signalements.some((s) => {
    if (s.date !== date) return false;
    const u = minutes(s.heure);
    return u != null && u >= t && u - t <= FENETRE_MIN;
  });
}

// Seuils : assez de repas pour juger, et nettement au-dessus de la moyenne.
const MIN_REPAS = 3;
const MIN_SUIVIS = 2;
const ECART_MIN = 0.25;

/**
 * Aliments et familles « suspects » pour cet utilisateur.
 * @param jours        [{ date, repas: [{ heure, aliments?, familles? }] }]
 * @param signalements [{ date, heure }]
 * @returns { suspects: [{ cle, nom, suivis, repas, taux }], repasAnalyses, tauxMoyen }
 *   cle d'une famille : "famille:<id>"
 */
export function suspectsPersonnels(jours, signalements) {
  const stats = new Map(); // cle -> { nom, repas, suivis }
  let total = 0;
  let totalSuivis = 0;
  for (const j of jours || []) {
    for (const r of j.repas || []) {
      if (!r.aliments) continue; // repas d'avant cette fonctionnalite
      const suivi = estSuivi(j.date, r.heure, signalements || []);
      total++;
      if (suivi) totalSuivis++;
      const cles = [
        ...r.aliments.map((a) => [a.cle, a.nom]),
        ...(r.familles || []).map((id) => {
          const regle = REGLES.find((x) => x.id === id);
          return [`famille:${id}`, regle ? regle.libelle : id];
        }),
      ];
      for (const [cle, nom] of cles) {
        const s = stats.get(cle) || { nom, repas: 0, suivis: 0 };
        s.repas++;
        if (suivi) s.suivis++;
        stats.set(cle, s);
      }
    }
  }
  const tauxMoyen = total ? totalSuivis / total : 0;
  const suspects = [...stats]
    .map(([cle, s]) => ({ cle, ...s, taux: s.suivis / s.repas }))
    .filter((s) => s.repas >= MIN_REPAS && s.suivis >= MIN_SUIVIS && s.taux >= tauxMoyen + ECART_MIN)
    .sort((a, b) => b.taux - a.taux || b.suivis - a.suivis);
  return { suspects, repasAnalyses: total, tauxMoyen };
}

/** Suspects personnels presents dans un repas (empreinteRepas). */
export function suspectsDuRepas(empreinte, suspects) {
  const cles = new Set([
    ...(empreinte.aliments || []).map((a) => a.cle),
    ...(empreinte.familles || []).map((id) => `famille:${id}`),
  ]);
  return (suspects || []).filter((s) => cles.has(s.cle));
}
