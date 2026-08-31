// Appels a l'IA vision de Google Gemini.
//
// Principe directeur : Gemini ne calcule PLUS les calories. Il fait ce qu'il
// sait faire (reconnaitre un aliment sur une photo, estimer un volume) et rien
// d'autre. Les valeurs nutritionnelles viennent de CIQUAL (voir ciqual.js).
//
// Le travail se fait en deux passes :
//   1. Vision   : photo -> aliments + portions estimees en grammes
//   2. Rerank   : pour chaque aliment, choisir la bonne fiche CIQUAL parmi une
//                 courte liste de candidates trouvees localement.
// La passe 2 existe parce qu'on ne peut pas demander a l'IA de deviner un code
// parmi 2 298 (elle en inventerait), mais qu'elle choisit tres bien dans une
// liste de 8.

import { cleGemini } from "./cle";
import { rechercher, parCode } from "./ciqual";

const MODELE = "gemini-flash-latest";
const NB_CANDIDATES = 8;

// --- Passe 1 : vision ------------------------------------------------------

const SCHEMA_VISION = {
  type: "OBJECT",
  properties: {
    plat: { type: "STRING" },
    aliments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nom: { type: "STRING" },
          requete_ciqual: { type: "STRING" },
          quantite_g: { type: "NUMBER" },
          quantite_min_g: { type: "NUMBER" },
          quantite_max_g: { type: "NUMBER" },
          base_estimation: { type: "STRING" },
          confiance: { type: "STRING" },
        },
        required: [
          "nom", "requete_ciqual", "quantite_g",
          "quantite_min_g", "quantite_max_g", "base_estimation", "confiance",
        ],
      },
    },
    remarques: { type: "STRING" },
  },
  required: ["plat", "aliments", "remarques"],
};

// Le prompt porte l'essentiel de la precision des portions. Trois leviers :
// des reperes d'echelle metriques, des portions usuelles servant d'ancrage
// (bien plus fiable qu'une estimation au pixel pour les aliments denombrables),
// et l'obligation d'annoncer une fourchette + la reference utilisee, ce qui
// force le modele a justifier son chiffre au lieu de le sortir au hasard.
const PROMPT_VISION = `Tu es un dieteticien qui evalue des portions a partir de photos.

ETAPE 1 — Identifie chaque aliment visible separement (ne regroupe pas un plat
en un seul item si tu distingues ses composants).

ETAPE 2 — Estime la MASSE de chaque aliment en grammes. Procede ainsi :
  a) Trouve un repere d'echelle dans l'image. Ordres de grandeur usuels :
     - assiette plate : 26-28 cm de diametre ; assiette creuse : 22 cm
     - fourchette / couteau : 19-21 cm de long
     - cuillere a soupe : creux de 3 cm ; verre : 8-10 cm de haut
     - canette : 6,6 cm de diametre ; smartphone : 14-16 cm
     - main adulte : paume ~10 x 9 cm
  b) Estime le VOLUME, pas seulement la surface occupee : tiens compte de
     l'epaisseur et de la hauteur du tas. Une erreur frequente est d'oublier
     la hauteur et de sous-estimer d'un facteur 2.
  c) Quand l'aliment est denombrable, compte-le et utilise ces masses usuelles
     plutot qu'une estimation visuelle :
     - 1 oeuf = 50 g | 1 tranche de pain de mie = 30 g | 1 tranche baguette = 25 g
     - 1 c. a soupe d'huile = 10 g | 1 noix de beurre = 10 g
     - 1 yaourt = 125 g | 1 tranche de jambon = 40 g | 1 tranche de fromage = 25 g
     - 1 pomme = 150 g | 1 banane epluchee = 120 g | 1 pomme de terre = 100 g
  d) Reperes de portions servies : une portion de feculents cuits (riz, pates)
     tient dans 150-250 g ; une portion de viande/poisson dans 100-180 g ;
     une portion de legumes dans 100-200 g. Sors de ces bornes seulement si la
     photo le justifie clairement.

ETAPE 3 — Pour chaque aliment, donne aussi :
  - "quantite_min_g" et "quantite_max_g" : ta fourchette honnete. Si tu vois mal
    l'aliment, elle doit etre large. Ne fais pas semblant d'etre precis.
  - "base_estimation" : en une phrase courte, le repere utilise et ton
    raisonnement ("assiette 26 cm, le riz couvre un quart sur ~2 cm d'epaisseur").
  - "confiance" : "faible", "moyenne" ou "elevee".

ETAPE 4 — Pour chaque aliment, remplis "requete_ciqual" : 2 a 5 mots en
francais pour retrouver l'aliment dans la table CIQUAL de l'ANSES. Precise
TOUJOURS l'etat de cuisson (cru / cuit / grille / frit / vapeur), car cru et
cuit n'ont pas du tout la meme densite calorique. Mets le nom de l'aliment en
premier. Exemples : "riz blanc cuit", "poulet escalope grillee",
"pomme de terre frite", "courgette cuite vapeur".

IMPORTANT : ne donne AUCUNE valeur nutritionnelle (ni calories, ni macros).
Elles sont calculees ailleurs a partir d'une base officielle. Ton seul travail
est d'identifier les aliments et d'estimer leurs masses.`;

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Erreur transitoire cote Google (modele surcharge, quota momentane) : ca vaut
// le coup de reessayer. Sinon (cle invalide, requete malformee), inutile.
function estTransitoire(status, message) {
  if (status === 429 || status === 500 || status === 503) return true;
  const m = (message || "").toLowerCase();
  return m.includes("overload") || m.includes("high demand") ||
    m.includes("unavailable") || m.includes("try again") || m.includes("rate limit");
}

async function appelerGemini(corps) {
  const cle = cleGemini();
  if (!cle) {
    throw new Error(
      "Aucune cle API Gemini. Ouvrez les Parametres (roue crantee) et collez " +
      "votre cle (https://aistudio.google.com/apikey)."
    );
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELE}:generateContent`;

  // La cle passe par l'en-tete x-goog-api-key, jamais par l'URL.
  //
  // Deux raisons. D'abord les clefs creees depuis 2025 dans AI Studio sont des
  // "auth keys" (prefixe "AQ.") et sont refusees en parametre ?key= ; seul
  // l'en-tete fonctionne. Ensuite une cle placee dans une URL se retrouve dans
  // les journaux des serveurs et des proxys traverses.
  //
  // Le modele Gemini gratuit est souvent surcharge ("high demand") : on reessaie
  // automatiquement quelques fois avec un delai croissant avant d'abandonner.
  const MAX_ESSAIS = 4;
  let derniere = null;

  for (let essai = 1; essai <= MAX_ESSAIS; essai++) {
    let reponse;
    try {
      reponse = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": cle },
        body: JSON.stringify(corps),
      });
    } catch (e) {
      // Erreur reseau : transitoire, on retente.
      derniere = e.message;
      if (essai < MAX_ESSAIS) { await pause(essai * 1200); continue; }
      throw new Error("Reseau indisponible. Verifiez votre connexion.");
    }

    const data = await reponse.json().catch(() => ({}));

    if (data.error) {
      derniere = data.error.message || "Erreur API";
      if (estTransitoire(reponse.status, derniere) && essai < MAX_ESSAIS) {
        await pause(essai * 1500); // 1.5s, 3s, 4.5s
        continue;
      }
      // Message clair pour le cas le plus frequent (surcharge).
      if (estTransitoire(reponse.status, derniere)) {
        throw new Error("Le service d'IA est surchargé. Réessayez dans un instant.");
      }
      throw new Error(derniere);
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const texte = parts.map((p) => p.text).filter(Boolean).join("");
    if (!texte) {
      // Reponse vide : parfois transitoire aussi, on retente une fois.
      derniere = "Reponse vide";
      if (essai < MAX_ESSAIS) { await pause(essai * 1200); continue; }
      throw new Error("Reponse vide de l'IA. Réessayez.");
    }
    return JSON.parse(texte);
  }

  throw new Error(derniere || "Échec de l'analyse. Réessayez.");
}

async function passeVision(base64) {
  return appelerGemini({
    contents: [
      {
        parts: [
          { inline_data: { mime_type: "image/jpeg", data: base64 } },
          { text: PROMPT_VISION },
        ],
      },
    ],
    generationConfig: {
      // Temperature basse : on veut une estimation reproductible, pas de la
      // creativite. Deux analyses de la meme photo doivent se ressembler.
      temperature: 0.2,
      response_mime_type: "application/json",
      response_schema: SCHEMA_VISION,
    },
  });
}

// --- Passe 2 : choix de la fiche CIQUAL ------------------------------------

const SCHEMA_CHOIX = {
  type: "OBJECT",
  properties: {
    choix: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          index: { type: "NUMBER" },
          code: { type: "NUMBER" },
        },
        required: ["index", "code"],
      },
    },
  },
  required: ["choix"],
};

/**
 * Demande a l'IA de choisir, pour chaque aliment, la fiche CIQUAL la plus
 * juste parmi les candidates trouvees localement.
 * Appel texte seul : rapide et bien moins couteux que la passe vision.
 */
async function passeChoix(alimentsAvecCandidates) {
  const listes = alimentsAvecCandidates
    .map((a, i) => {
      const lignes = a.candidates
        .map((c) => `    - code ${c.code} : ${c.nom} (${c.kcal} kcal/100 g)`)
        .join("\n");
      return `  [${i}] Aliment vu sur la photo : "${a.nom}"\n${lignes}`;
    })
    .join("\n\n");

  const prompt = `Pour chaque aliment ci-dessous, choisis la fiche de la table
CIQUAL qui lui correspond le mieux. Reponds avec le code de la fiche choisie.

Regles de choix, par ordre d'importance :
1. L'ETAT DE CUISSON doit correspondre (un aliment cru et le meme aliment cuit
   n'ont pas la meme densite calorique : le riz passe de 350 a 145 kcal/100 g).
2. L'aliment lui-meme doit correspondre : ne choisis pas un plat compose si
   l'aliment est simple. Pour "blanc de poulet", prends une fiche de poulet, pas
   une fiche de plat contenant du poulet.
3. A egalite, prends la fiche la plus generique plutot qu'une variete precise.

Si aucune candidate ne convient vraiment, prends quand meme la moins mauvaise.

${listes}`;

  return appelerGemini({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      response_mime_type: "application/json",
      response_schema: SCHEMA_CHOIX,
    },
  });
}

// --- Orchestration ---------------------------------------------------------

/**
 * Analyse complete d'une photo.
 * Renvoie les aliments detectes, chacun rattache a sa fiche CIQUAL et
 * accompagne de la liste des autres candidates (pour que l'utilisateur puisse
 * corriger le rattachement dans l'interface).
 */
export async function analyserPhoto(base64) {
  const vision = await passeVision(base64);
  const detectes = Array.isArray(vision.aliments) ? vision.aliments : [];

  // Recherche locale des candidates pour chaque aliment.
  const avecCandidates = detectes.map((a) => ({
    ...a,
    candidates: rechercher(a.requete_ciqual || a.nom, NB_CANDIDATES),
  }));

  // On n'appelle la passe 2 que pour les aliments ou il y a un vrai choix a
  // faire : inutile de payer un appel si tout est deja tranche.
  const aTrancher = avecCandidates.filter((a) => a.candidates.length > 1);

  let choixParIndex = new Map();
  if (aTrancher.length > 0) {
    try {
      const rep = await passeChoix(aTrancher);
      for (const c of rep.choix || []) {
        const aliment = aTrancher[c.index];
        if (aliment) choixParIndex.set(aliment, Number(c.code));
      }
    } catch (e) {
      // La passe 2 n'est qu'une amelioration : si elle echoue (reseau, quota),
      // on garde le meilleur resultat de la recherche locale plutot que de
      // faire echouer toute l'analyse.
      console.warn("Passe de choix CIQUAL echouee, repli sur la recherche locale :", e.message);
    }
  }

  const aliments = avecCandidates.map((a) => {
    const codeChoisi = choixParIndex.get(a);
    // Le code doit exister ET figurer parmi les candidates proposees : sinon
    // c'est que le modele l'a invente, et on l'ignore.
    const retenu =
      (codeChoisi != null && a.candidates.some((c) => c.code === codeChoisi)
        ? parCode(codeChoisi)
        : null) || a.candidates[0] || null;

    return {
      nom: a.nom,
      requete: a.requete_ciqual,
      grammes: Math.max(0, Math.round(Number(a.quantite_g) || 0)),
      grammesMin: Math.max(0, Math.round(Number(a.quantite_min_g) || 0)),
      grammesMax: Math.max(0, Math.round(Number(a.quantite_max_g) || 0)),
      baseEstimation: a.base_estimation || "",
      confiance: a.confiance || "",
      fiche: retenu,
      candidates: a.candidates,
    };
  });

  return { plat: vision.plat || "Plat", remarques: vision.remarques || "", aliments };
}
