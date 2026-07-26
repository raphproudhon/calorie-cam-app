// Calcul du besoin calorique journalier et de l'objectif selon le but choisi.
//
// Trois etapes :
//   1. BMR (metabolisme de base) : energie au repos complet — equation de
//      Mifflin-St Jeor, la plus fiable sur population generale.
//   2. TDEE (depense totale) : BMR x facteur d'activite.
//   3. Objectif : TDEE moins un deficit (perte) ou plus un surplus (prise),
//      borne par des garde-fous de securite.
//
// PRINCIPE DE SECURITE (le "sans mettre la sante en danger" demande) :
//   - le deficit de perte est modere (pas de regime agressif) ;
//   - l'objectif ne descend JAMAIS sous un plancher absolu (1200 kcal femme,
//     1500 kcal homme), seuils en-deca desquels un suivi medical s'impose ;
//   - le surplus de prise reste faible pour limiter la prise de gras.
//
// Ce module ne remplace pas un professionnel de sante : c'est un calculateur
// grand public, avec les memes formules que les outils de reference, et des
// bornes volontairement prudentes.

// --- Constantes physiologiques ---------------------------------------------

// Planchers caloriques absolus largement admis pour un regime sans supervision
// medicale. En-dessous, risque de carences : on refuse de descendre plus bas.
const PLANCHER = { homme: 1500, femme: 1200 };

// 1 kg de masse grasse libere/stocke ~7700 kcal. Sert a traduire un ecart
// calorique journalier en rythme hebdomadaire, l'info concrete pour l'usager.
const KCAL_PAR_KG = 7700;

// Facteur FIXE applique au BMR pour obtenir le maintien "au repos et vie
// courante", HORS sport. On n'utilise volontairement PAS le niveau d'activite
// choisi par l'utilisateur : dans cette app, la depense de sport est comptee
// separement et uniquement a partir d'Apple Sante (energie active), pour eviter
// tout double comptage. 1.2 = valeur sedentaire standard (le corps depense un
// peu plus que le seul metabolisme de base rien qu'en vivant : digestion,
// posture, deplacements du quotidien).
const FACTEUR_MAINTIEN_BASE = 1.2;

// Facteurs d'activite appliques au BMR pour obtenir la TDEE (valeurs usuelles).
export const ACTIVITES = [
  { cle: "sedentaire", libelle: "Sédentaire (peu ou pas de sport)", facteur: 1.2 },
  { cle: "leger", libelle: "Léger (sport 1-3 j/sem)", facteur: 1.375 },
  { cle: "modere", libelle: "Modéré (sport 3-5 j/sem)", facteur: 1.55 },
  { cle: "intense", libelle: "Intense (sport 6-7 j/sem)", facteur: 1.725 },
  { cle: "tres_intense", libelle: "Très intense (sport + travail physique)", facteur: 1.9 },
];

// Rythmes proposes par objectif. Exprimes en % de la TDEE : un pourcentage
// s'adapte a la corpulence, la ou un forfait en kcal serait trop dur pour un
// petit gabarit et trop doux pour un grand.
export const RYTHMES = {
  perte: [
    { cle: "doux", libelle: "Doux", pourcentage: 0.10, apercu: "≈ 0,25 kg/sem" },
    { cle: "standard", libelle: "Standard (conseillé)", pourcentage: 0.20, apercu: "≈ 0,5 kg/sem" },
  ],
  prise: [
    { cle: "doux", libelle: "Doux (prise sèche)", pourcentage: 0.05, apercu: "≈ 0,1-0,2 kg/sem" },
    { cle: "standard", libelle: "Standard (conseillé)", pourcentage: 0.12, apercu: "≈ 0,25-0,4 kg/sem" },
  ],
};

// Bornes de saisie plausibles. Hors de ces bornes, le calcul n'a pas de sens
// et signale probablement une faute de frappe.
export const BORNES = {
  age: { min: 15, max: 100 },
  poids: { min: 30, max: 300 }, // kg
  taille: { min: 120, max: 230 }, // cm
};

// --- Calculs de base -------------------------------------------------------

/** Metabolisme de base (kcal/j), equation de Mifflin-St Jeor. */
export function calculerBMR({ sexe, poids, taille, age }) {
  const base = 10 * poids + 6.25 * taille - 5 * age;
  return base + (sexe === "homme" ? 5 : -161);
}

/** Depense energetique totale (kcal/j) = BMR x facteur d'activite. */
export function calculerTDEE(bmr, cleActivite) {
  const a = ACTIVITES.find((x) => x.cle === cleActivite) || ACTIVITES[0];
  return bmr * a.facteur;
}

// --- Objectif selon le but -------------------------------------------------

/**
 * Calcule l'objectif calorique complet.
 *
 * @param profil { sexe, poids(kg), taille(cm), age }
 * @param but "maintien" | "perte" | "prise"
 * @param cleActivite  une cle de ACTIVITES
 * @param cleRythme    une cle de RYTHMES[but] (ignore si maintien)
 * @returns objet detaille, incluant d'eventuels avertissements de securite.
 */
export function calculerObjectif(profil, but, cleActivite, cleRythme) {
  const erreurs = validerProfil(profil);
  if (erreurs.length) return { ok: false, erreurs };

  const bmr = Math.round(calculerBMR(profil));
  // Choix d'architecture (voir FACTEUR_MAINTIEN_BASE) : le maintien de base
  // n'inclut PAS le sport. Le niveau d'activite choisi par l'utilisateur n'entre
  // donc plus dans le calcul (il reste affiche a titre indicatif). La depense de
  // sport est comptee ailleurs, uniquement via Apple Sante (voir bilanJournalier).
  const tdee = Math.round(bmr * FACTEUR_MAINTIEN_BASE);
  const plancher = PLANCHER[profil.sexe] || PLANCHER.femme;

  const avertissements = [];
  let objectif = tdee;
  let ecartVise = 0; // ecart calorique journalier demande (signe)

  let deficitImpossible = false;

  if (but === "perte") {
    const rythme = trouverRythme("perte", cleRythme);
    ecartVise = -Math.round(tdee * rythme.pourcentage);
    objectif = tdee + ecartVise;

    // Garde-fou : ne jamais passer sous le plancher de securite.
    if (objectif < plancher) {
      objectif = plancher;
      avertissements.push(
        `Le déficit a été réduit pour ne pas descendre sous ${plancher} kcal, ` +
          `seuil de sécurité pour ${profil.sexe === "homme" ? "un homme" : "une femme"}. ` +
          `En-dessous, un suivi par un professionnel de santé est nécessaire.`
      );
    }

    // Cas limite : la depense de maintien est elle-meme au niveau (ou en-dessous)
    // du plancher de securite. Aucun deficit sain n'est alors possible — on
    // refuse de proposer un objectif de perte, qui reviendrait a prescrire de
    // manger MOINS que ce plancher, ou (apres bridage) PLUS que la maintenance.
    if (objectif >= tdee) {
      deficitImpossible = true;
      objectif = plancher;
      avertissements.length = 0; // remplace le message precedent, moins clair ici
      avertissements.push(
        `Votre dépense de maintien (${tdee} kcal) est déjà proche du seuil de ` +
          `sécurité. Perdre du poids en mangeant moins ne serait pas prudent ici : ` +
          `mieux vaut augmenter l'activité physique et consulter un professionnel ` +
          `de santé. La valeur affichée est le minimum à ne pas descendre en-dessous.`
      );
    }
    // NB : on ne signale PAS l'objectif "sous le metabolisme de base". Le
    // maintien de base etant BMR x 1.2, un deficit standard le place juste sous
    // le BMR par construction (ex. 0.96 x BMR) : ce serait une alerte a chaque
    // calcul, donc du bruit. Le vrai garde-fou reste le plancher absolu
    // (1200/1500 kcal), lui applique plus haut, et l'ajout des calories de sport
    // (Apple Sante) remonte le budget les jours d'activite.
  } else if (but === "prise") {
    const rythme = trouverRythme("prise", cleRythme);
    ecartVise = Math.round(tdee * rythme.pourcentage);
    objectif = tdee + ecartVise;
  } else {
    but = "maintien";
  }

  // Ecart reellement obtenu apres application des garde-fous (peut differer de
  // l'ecart vise si on a bute sur le plancher). Force a 0 quand aucun deficit
  // n'est possible, pour ne pas afficher un rythme de perte trompeur.
  const ecartReel = deficitImpossible ? 0 : objectif - tdee;
  const rythmeHebdoKg = Math.round((Math.abs(ecartReel) * 7 / KCAL_PAR_KG) * 100) / 100;

  return {
    ok: true,
    but,
    bmr,
    tdee,
    objectif,
    ecartVise,
    ecartReel,
    rythmeHebdoKg,
    plancher,
    deficitImpossible,
    avertissements,
    macros: repartirMacros(objectif, but, profil.poids),
  };
}

/**
 * Repartition indicative en macronutriments.
 * Les proteines sont ancrees au poids corporel (recommandations sportives
 * usuelles), le reste partage entre lipides et glucides.
 */
function repartirMacros(kcal, but, poids) {
  // g de proteines par kg de poids : un peu plus en perte (preserver le muscle)
  // et en prise (construire le muscle) qu'au simple maintien.
  const gProtParKg = but === "maintien" ? 1.6 : 2.0;
  const proteines = Math.round(poids * gProtParKg);
  const kcalProteines = proteines * 4;

  // Lipides : 30 % des calories totales (borne basse saine ~0,8 g/kg garantie).
  let lipides = Math.round((kcal * 0.3) / 9);
  const lipidesMin = Math.round(poids * 0.8);
  if (lipides < lipidesMin) lipides = lipidesMin;
  const kcalLipides = lipides * 9;

  // Glucides : le solde.
  const kcalGlucides = Math.max(0, kcal - kcalProteines - kcalLipides);
  const glucides = Math.round(kcalGlucides / 4);

  return { proteines, glucides, lipides };
}

// --- Bilan du jour : calories restantes ------------------------------------

/**
 * Calcule les calories restantes pour la journee, modele "add-back" :
 *   budget  = objectif (au repos, hors sport) + sport du jour
 *   restant = budget - consomme
 *
 * Le sport ne provient QUE d'Apple Sante (ou d'une saisie manuelle en attendant
 * le build de developpement) : l'objectif de base n'incluant aucune activite,
 * il n'y a pas de double comptage possible.
 *
 * @param objectif   objectif calorique de base (kcal, hors sport)
 * @param sport      calories depensees en sport aujourd'hui (kcal, Apple Sante)
 * @param consomme   calories deja mangees aujourd'hui (kcal)
 */
export function bilanJournalier({ objectif, sport = 0, consomme = 0 }) {
  const obj = Math.max(0, Math.round(Number(objectif) || 0));
  const spt = Math.max(0, Math.round(Number(sport) || 0));
  const cons = Math.max(0, Math.round(Number(consomme) || 0));

  const budget = obj + spt;
  const restant = budget - cons;

  return {
    budget,
    restant,
    depassement: restant < 0 ? -restant : 0,
    part: budget > 0 ? Math.min(1, cons / budget) : 0, // pour une barre de progression
    avertissements: [],
  };
}

// --- Validation ------------------------------------------------------------

function validerProfil(p) {
  const e = [];
  if (!p || (p.sexe !== "homme" && p.sexe !== "femme")) e.push("Sexe manquant.");
  for (const [champ, libelle] of [["age", "âge"], ["poids", "poids"], ["taille", "taille"]]) {
    const v = Number(p?.[champ]);
    const b = BORNES[champ];
    if (!Number.isFinite(v) || v < b.min || v > b.max) {
      e.push(`${libelle} attendu entre ${b.min} et ${b.max}.`);
    }
  }
  return e;
}

function trouverRythme(but, cle) {
  const liste = RYTHMES[but];
  return liste.find((r) => r.cle === cle) || liste[liste.length - 1];
}
