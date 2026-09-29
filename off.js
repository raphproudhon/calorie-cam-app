// Recherche d'un produit emballe par code-barres via Open Food Facts.
//
// Gratuit, sans cle. Complement de la table Ciqual : pour un produit industriel
// (biscuits, plat prepare...), les valeurs du fabricant sont plus justes qu'une
// fiche generique. On met le produit a la MEME forme qu'une fiche Ciqual (valeurs
// pour 100 g) pour qu'il passe dans calculer() (ciqual.js) et dans l'affichage.

const BASE = "https://world.openfoodfacts.org/api/v2/product/";

function nombre(v) {
  const n = Number(v);
  // Arrondi au dixieme : OFF renvoie parfois des valeurs recalculees brutes
  // ("353.225806451613").
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

/**
 * Recupere un produit par son code-barres.
 * @returns {Promise<object|null>} une "fiche" (valeurs /100 g) ou null si introuvable.
 */
export async function produitParCodeBarres(code) {
  const champs =
    "product_name,product_name_fr,brands,nutriments,quantity";
  const url = `${BASE}${encodeURIComponent(code)}.json?fields=${champs}`;

  const rep = await fetch(url, {
    // Open Food Facts recommande un User-Agent identifiant l'app.
    headers: { "User-Agent": "CalorieCam - perso - github.com/raphproudhon" },
  });
  const data = await rep.json();
  if (data.status !== 1 || !data.product) return null;

  return ficheDepuisProduit(data.product, code);
}

/** Produit Open Food Facts -> fiche (valeurs pour 100 g), ou null sans calories. */
function ficheDepuisProduit(p, code) {
  const n = p.nutriments || {};
  const nom = (p.product_name_fr || p.product_name || "Produit").trim();
  const marque = (p.brands || "").split(",")[0].trim();

  // Energie : OFF donne parfois seulement des kJ -> on convertit (1 kcal = 4,184 kJ).
  let kcal = nombre(n["energy-kcal_100g"]);
  if (kcal == null) {
    const kj = nombre(n["energy-kj_100g"]) ?? nombre(n["energy_100g"]);
    if (kj != null) kcal = kj / 4.184;
  }
  if (kcal != null) kcal = Math.round(kcal);

  return {
    code,
    nom: marque ? `${nom} — ${marque}` : nom,
    kcal, // /100 g
    prot: nombre(n["proteins_100g"]),
    gluc: nombre(n["carbohydrates_100g"]),
    lip: nombre(n["fat_100g"]),
    sucres: nombre(n["sugars_100g"]),
    fibres: nombre(n["fiber_100g"]),
    sel: nombre(n["salt_100g"]),
    conf: null, // pas de code de confiance ANSES pour un produit OFF
    source: "Open Food Facts",
    quantite: p.quantity || null, // ex "300 g" (informatif)
  };
}

/**
 * Cherche des produits de marque par leur nom ("kinder bueno"), pour ce que la
 * table Ciqual, faite d'aliments generiques, ne contient pas. Seuls les
 * produits dont on connait les calories sont gardes.
 */
export async function chercherProduits(texte, limite = 8) {
  const champs = "code,product_name,product_name_fr,brands,nutriments,quantity";
  const entete = { "User-Agent": "CalorieCam - perso - github.com/raphproudhon" };
  // Deux moteurs de recherche chez Open Food Facts : le classique, souvent
  // sature (503), et le recent (search-a-licious). On essaie le classique, on
  // retente une fois, puis on passe au recent.
  const sources = [
    async () => {
      const params = [
        `search_terms=${encodeURIComponent(texte)}`,
        "search_simple=1", "action=process", "json=1",
        `page_size=${limite * 2}`, `fields=${champs}`,
      ].join("&");
      const rep = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, { headers: entete });
      if (!rep.ok) throw new Error(`Open Food Facts : erreur ${rep.status}`);
      return (await rep.json()).products || [];
    },
    async () => {
      const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(texte)}` +
        `&page_size=${limite * 2}&fields=${champs}`;
      const rep = await fetch(url, { headers: entete });
      if (!rep.ok) throw new Error(`Open Food Facts : erreur ${rep.status}`);
      const data = await rep.json();
      // Ici les marques arrivent parfois en tableau.
      return (data.hits || data.products || []).map((p) => ({
        ...p,
        brands: Array.isArray(p.brands) ? p.brands.join(",") : p.brands,
      }));
    },
  ];
  const essais = [sources[0], sources[0], sources[1]];
  let produits = null;
  let erreur = null;
  for (let i = 0; i < essais.length && produits === null; i++) {
    try {
      produits = await essais[i]();
    } catch (e) {
      erreur = e;
      if (i === 0) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (produits === null) throw erreur;

  // Un meme produit existe en plusieurs formats (x8, x10, mini...) avec les
  // memes valeurs pour 100 g : on n'en garde qu'un, au nom le plus court.
  const parValeurs = new Map();
  for (const p of produits) {
    const f = ficheDepuisProduit(p, p.code);
    if (f.kcal == null || !f.code) continue;
    const cle = [f.kcal, f.prot, f.gluc, f.lip].join("|");
    const deja = parValeurs.get(cle);
    if (!deja || f.nom.length < deja.nom.length) parValeurs.set(cle, f);
  }
  return [...parValeurs.values()].slice(0, limite);
}

/** Un aliment (forme attendue par l'affichage) a partir d'une fiche produit. */
export function alimentDepuisProduit(fiche) {
  return {
    nom: fiche.nom,
    requete: "",
    grammes: 100, // OFF est pour 100 g : point de depart, l'utilisateur ajuste
    grammesMin: 0,
    grammesMax: 0,
    baseEstimation: "",
    confiance: "",
    fiche,
    candidates: [],
  };
}

/**
 * Construit une "analyse" (meme forme que analyserPhoto) a partir d'une fiche
 * produit, avec un seul aliment. Passe directement dans l'affichage et le bilan.
 */
export function analyseDepuisProduit(fiche) {
  return {
    plat: "Produits scannés",
    remarques:
      "Produits scannés (Open Food Facts). Valeurs pour 100 g — ajustez chaque quantité consommée.",
    aliments: [alimentDepuisProduit(fiche)],
    id: Date.now(),
  };
}
