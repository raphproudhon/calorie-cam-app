// Convertit la table CIQUAL 2020 de l'ANSES (XML) en un fichier JSON compact
// embarque dans l'app : data/ciqual.json
//
// Pourquoi ce script : le XML officiel fait 100 Mo decompresse et contient 67
// constituants par aliment. L'app n'en utilise que 7. On produit donc un JSON
// reduit (~400 Ko) qu'on commit dans le repo, pour que l'app fonctionne
// hors-ligne sans dependance reseau.
//
// USAGE :
//   1. Telecharger  https://ciqual.anses.fr/cms/sites/default/files/inline-files/XML_2020_07_07.zip
//   2. Decompresser l'archive dans un dossier
//   3. node tools/build-ciqual.js <dossier-des-xml>
//
// Le JSON produit est versionne dans Git : ce script ne sert qu'a regenerer
// les donnees quand l'ANSES publie une nouvelle table.

const fs = require("fs");
const path = require("path");

// --- Codes des constituants CIQUAL qu'on garde -----------------------------
// (releves dans const_2020_07_07.xml)
const ENERGIE_KCAL = 328; // Energie, Reglement UE N 1169/2011 (kcal/100 g)
const PROTEINES = 25000; // Proteines, N x facteur de Jones (g/100 g)
const PROTEINES_ALT = 25003; // Proteines, N x 6.25 — repli si 25000 absent
const GLUCIDES = 31000;
const SUCRES = 32000;
const FIBRES = 34100;
const LIPIDES = 40000;
const SEL = 10004;

const CODES_GARDES = new Set([
  ENERGIE_KCAL,
  PROTEINES,
  PROTEINES_ALT,
  GLUCIDES,
  SUCRES,
  FIBRES,
  LIPIDES,
  SEL,
]);

// --- Lecture des XML (encodage windows-1252) -------------------------------

// Le XML de l'ANSES est en windows-1252. Node ne sait decoder que 'latin1',
// qui est identique SAUF sur les octets 0x80-0x9F. Sans cette table, les
// caracteres comme 'oe' (0x9C, dans "oeuf", "coeur") seraient corrompus.
const CP1252_HAUT = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„",
  0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ",
  0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ",
  0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“",
  0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—",
  0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›",
  0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};

function lireCp1252(fichier) {
  const buf = fs.readFileSync(fichier);
  let out = "";
  for (const octet of buf) {
    out += octet >= 0x80 && octet <= 0x9f
      ? CP1252_HAUT[octet] || "�"
      : String.fromCharCode(octet);
  }
  return out;
}

/**
 * Extrait la valeur d'une balise simple dans un fragment XML.
 *
 * Attention : le XML de l'ANSES contient des '<' NON echappes dans certains
 * libelles ("Panache preemballe (<1 alc.)", "compotes allegees < desserts"),
 * ce qui le rend techniquement invalide. On lit donc jusqu'a la balise
 * fermante (non-greedy) plutot que "tout sauf '<'", sinon ces 4 aliments
 * seraient silencieusement perdus.
 */
function baliseTexte(fragment, balise) {
  const m = fragment.match(new RegExp(`<${balise}>([\\s\\S]*?)</${balise}>`));
  return m ? m[1].trim() : null;
}

/** Decoupe le XML en blocs <NOM>...</NOM>. */
function blocs(xml, nom) {
  return xml.match(new RegExp(`<${nom}>[\\s\\S]*?</${nom}>`, "g")) || [];
}

/**
 * Convertit une teneur CIQUAL en nombre.
 * Cas particuliers de la table : "-" = donnee absente, "traces" = quantite
 * negligeable, et la virgule est le separateur decimal.
 */
function teneurEnNombre(brut) {
  if (!brut) return null;
  const t = brut.trim();
  if (t === "-" || t === "") return null;
  if (t.toLowerCase() === "traces") return 0;
  const n = Number(t.replace(",", ".").replace("<", "").trim());
  return Number.isFinite(n) ? n : null;
}

// --- Programme -------------------------------------------------------------

function main() {
  const dossier = process.argv[2];
  if (!dossier) {
    console.error("Usage : node tools/build-ciqual.js <dossier-des-xml>");
    process.exit(1);
  }

  // Les noms de fichiers portent la date de publication (alim_2020_07_07.xml),
  // qui change a chaque version de la table : on matche sur le prefixe suivi
  // d'un chiffre, sinon "alim_" attraperait aussi "alim_grp_".
  const fichier = (prefixe) => {
    const motif = new RegExp(`^${prefixe}\\d.*\\.xml$`, "i");
    const trouve = fs.readdirSync(dossier).find((f) => motif.test(f));
    if (!trouve) throw new Error(`Fichier introuvable dans ${dossier} : ${prefixe}<date>.xml`);
    return path.join(dossier, trouve);
  };

  // 1. Groupes d'aliments (pour lever les ambiguites a l'affichage)
  const groupes = new Map();
  for (const b of blocs(lireCp1252(fichier("alim_grp_")), "ALIM_GRP")) {
    const code = baliseTexte(b, "alim_ssgrp_code");
    const nom = baliseTexte(b, "alim_ssgrp_nom_fr");
    if (code && nom && nom !== "-") groupes.set(code, nom);
  }
  console.log(`Groupes         : ${groupes.size}`);

  // 2. Aliments
  const aliments = new Map();
  for (const b of blocs(lireCp1252(fichier("alim_")), "ALIM")) {
    const code = Number(baliseTexte(b, "alim_code"));
    const nom = baliseTexte(b, "alim_nom_fr");
    if (!code || !nom) continue;
    aliments.set(code, {
      code,
      nom,
      groupe: groupes.get(baliseTexte(b, "alim_ssgrp_code")) || "",
      valeurs: {},
      confiance: null,
    });
  }
  console.log(`Aliments        : ${aliments.size}`);

  // 3. Composition — le gros fichier (57 Mo), lu en flux ligne par ligne pour
  //    parcouru ligne par ligne : un parseur XML a coups de regex sur 57 Mo
  //    serait bien plus lent, et le format genere est parfaitement regulier.
  const compo = lireCp1252(fichier("compo_"));
  let bloc = null;
  for (const ligne of compo.split("\n")) {
    if (ligne.includes("<COMPO>")) { bloc = { }; continue; }
    if (ligne.includes("</COMPO>")) {
      if (bloc && CODES_GARDES.has(bloc.const)) {
        const al = aliments.get(bloc.alim);
        if (al) {
          al.valeurs[bloc.const] = bloc.teneur;
          if (bloc.const === ENERGIE_KCAL) al.confiance = bloc.conf;
        }
      }
      bloc = null;
      continue;
    }
    if (!bloc) continue;
    const m = ligne.match(/<(alim_code|const_code|teneur|code_confiance)>([^<]*)</);
    if (!m) continue;
    if (m[1] === "alim_code") bloc.alim = Number(m[2].trim());
    else if (m[1] === "const_code") bloc.const = Number(m[2].trim());
    else if (m[1] === "teneur") bloc.teneur = teneurEnNombre(m[2]);
    else bloc.conf = m[2].trim() || null;
  }

  // 4. Format compact : tableau de tableaux plutot qu'objets nommes.
  //    Divise la taille du fichier par ~3 (les cles ne sont pas repetees
  //    3 185 fois), ce qui compte pour un bundle mobile.
  const CHAMPS = ["code", "nom", "groupe", "kcal", "prot", "gluc", "lip", "sucres", "fibres", "sel", "conf"];
  const arrondir = (v) => (v == null ? null : Math.round(v * 100) / 100);

  const lignes = [];
  let sansEnergie = 0;
  for (const al of aliments.values()) {
    const kcal = al.valeurs[ENERGIE_KCAL];
    // ~890 aliments de la table n'ont aucune valeur energetique renseignee.
    // On les exclut : ils sont inutilisables pour un compteur de calories et
    // surtout ils polluent la recherche (un "poulet" sans kcal ferait echouer
    // le calcul alors qu'une meilleure fiche existe).
    if (kcal == null) { sansEnergie++; continue; }
    lignes.push([
      al.code,
      al.nom,
      al.groupe,
      arrondir(kcal),
      arrondir(al.valeurs[PROTEINES] ?? al.valeurs[PROTEINES_ALT]),
      arrondir(al.valeurs[GLUCIDES]),
      arrondir(al.valeurs[LIPIDES]),
      arrondir(al.valeurs[SUCRES]),
      arrondir(al.valeurs[FIBRES]),
      arrondir(al.valeurs[SEL]),
      al.confiance,
    ]);
  }
  lignes.sort((a, b) => a[0] - b[0]);

  const sortie = {
    source: "Table Ciqual 2020 — ANSES (https://ciqual.anses.fr)",
    licence: "Licence Ouverte / Open Licence (Etalab)",
    genere_le: new Date().toISOString().slice(0, 10),
    champs: CHAMPS,
    aliments: lignes,
  };

  const dest = path.join(__dirname, "..", "data", "ciqual.json");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(sortie), "utf8");

  const ko = Math.round(fs.statSync(dest).size / 1024);
  console.log(`Ecartes (0 kcal): ${sansEnergie}`);
  console.log(`Retenus         : ${lignes.length}`);
  console.log(`Ecrit           : ${dest} (${ko} Ko)`);
}

main();
