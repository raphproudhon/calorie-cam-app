// Appels aux IA vision, interchangeables : Gemini, Claude, ChatGPT, Mistral.
//
// analyse.js decrit CE QU'IL FAUT DEMANDER (prompts, schemas des reponses) ;
// ce fichier sait COMMENT le demander a chaque IA. Toutes rendent le meme
// objet JSON, conforme au schema : le reste de l'app ne sait pas quelle IA a
// repondu.
//
// Rappel de la regle du projet : aucune IA ne fournit de valeur nutritionnelle.
// Elles identifient les aliments et estiment les masses ; les calories viennent
// de la table CIQUAL. Changer d'IA ne change donc rien a ce principe.
//
// IA utilisee : Gemini en priorite, puis les autres IA qui ont une cle (voir
// ordreIA). Si l'une echoue, pour quelque raison que ce soit, on essaie la
// suivante plutot que d'echouer.
//
// L'utilisateur n'a qu'a coller une cle : reconnaitreCle() devine l'IA d'apres
// sa forme, puis le verifie aupres du service (et y choisit le modele).

import Anthropic from "@anthropic-ai/sdk";
import { cleDe, modeleDe, FOURNISSEURS, IDS_FOURNISSEURS } from "./cle";

const MODELE_GEMINI = "gemini-flash-latest";
const MODELE_CLAUDE = "claude-opus-5-5";
// ChatGPT et Mistral : le modele est choisi a l'enregistrement de la cle parmi
// ceux qu'elle donne le droit d'utiliser (choisirModele). Ceux-ci ne servent
// que si ce choix n'a pas pu se faire.
const MODELE_OPENAI = "gpt-4o";
const MODELE_MISTRAL = "mistral-medium-latest";
const URL_OPENAI = "https://api.openai.com/v1";
const URL_MISTRAL = "https://api.mistral.ai/v1";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Erreur dont l'IA n'est pas responsable pour de bon (surcharge, reseau) : une autre IA peut prendre le relais. */
function erreurTransitoire(message) {
  const e = new Error(message);
  e.transitoire = true;
  return e;
}

// --- Gemini (API REST de Google) --------------------------------------------

// Erreur transitoire cote Google (modele surcharge, quota momentane) : ca vaut
// le coup de reessayer. Sinon (cle invalide, requete malformee), inutile.
function estTransitoireGemini(status, message) {
  if (status === 429 || status === 500 || status === 503) return true;
  const m = (message || "").toLowerCase();
  return m.includes("overload") || m.includes("high demand") ||
    m.includes("unavailable") || m.includes("try again") || m.includes("rate limit");
}

async function appelerGemini(cle, { image, texte, schema, temperature }) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELE_GEMINI}:generateContent`;
  const parts = [];
  if (image) parts.push({ inline_data: { mime_type: "image/jpeg", data: image } });
  parts.push({ text: texte });
  const corps = {
    contents: [{ parts }],
    generationConfig: {
      temperature,
      response_mime_type: "application/json",
      response_schema: schema,
    },
  };

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
      throw erreurTransitoire("Reseau indisponible. Verifiez votre connexion.");
    }

    const data = await reponse.json().catch(() => ({}));

    if (data.error) {
      derniere = data.error.message || "Erreur API";
      if (estTransitoireGemini(reponse.status, derniere) && essai < MAX_ESSAIS) {
        await pause(essai * 1500); // 1.5s, 3s, 4.5s
        continue;
      }
      // Message clair pour le cas le plus frequent (surcharge).
      if (estTransitoireGemini(reponse.status, derniere)) {
        throw erreurTransitoire("Le service d'IA est surchargé. Réessayez dans un instant.");
      }
      throw new Error(derniere);
    }

    const morceaux = data?.candidates?.[0]?.content?.parts || [];
    const sortie = morceaux.map((p) => p.text).filter(Boolean).join("");
    if (!sortie) {
      // Reponse vide : parfois transitoire aussi, on retente une fois.
      derniere = "Reponse vide";
      if (essai < MAX_ESSAIS) { await pause(essai * 1200); continue; }
      throw erreurTransitoire("Reponse vide de l'IA. Réessayez.");
    }
    return JSON.parse(sortie);
  }

  throw erreurTransitoire(derniere || "Échec de l'analyse. Réessayez.");
}

// --- Claude (SDK officiel d'Anthropic) --------------------------------------

/**
 * Schema au format Gemini (types en majuscules, sous-ensemble d'OpenAPI) ->
 * JSON Schema standard, tel que l'attendent les sorties structurees de Claude
 * (tout objet doit fermer ses proprietes : additionalProperties false).
 */
export function versJsonSchema(s) {
  if (!s || typeof s !== "object") return s;
  const out = { type: String(s.type || "").toLowerCase() };
  if (s.properties) {
    out.properties = Object.fromEntries(
      Object.entries(s.properties).map(([k, v]) => [k, versJsonSchema(v)])
    );
    out.additionalProperties = false;
  }
  if (s.required) out.required = [...s.required];
  if (s.items) out.items = versJsonSchema(s.items);
  if (s.enum) out.enum = [...s.enum];
  return out;
}

async function appelerClaude(cle, { image, texte, schema }) {
  // La cle est celle de l'utilisateur, saisie sur son propre appareil : c'est
  // le meme modele que pour Gemini. Le SDK refuse par defaut de tourner dans un
  // navigateur (version web), d'ou l'option.
  const client = new Anthropic({ apiKey: cle, dangerouslyAllowBrowser: true, maxRetries: 3 });

  const contenu = [];
  if (image) {
    contenu.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } });
  }
  contenu.push({ type: "text", text: texte });

  let reponse;
  try {
    reponse = await client.beta.messages.create({
      model: MODELE_CLAUDE,
      max_tokens: 16000,
      // Si le modele decline la demande (filtre de securite trop zele sur une
      // photo de repas), l'API la rejoue d'elle-meme sur un modele de secours.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: versJsonSchema(schema) },
      },
      messages: [{ role: "user", content: contenu }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      throw new Error("Clé Claude refusée. Vérifiez-la dans les Paramètres.");
    }
    if (e instanceof Anthropic.PermissionDeniedError) {
      throw new Error("Cette clé Claude n'a pas accès au modèle (crédit épuisé ?).");
    }
    if (e instanceof Anthropic.BadRequestError) {
      throw new Error(e.message);
    }
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError ||
        e instanceof Anthropic.APIConnectionError) {
      throw erreurTransitoire("Claude est surchargé ou injoignable. Réessayez dans un instant.");
    }
    if (e instanceof Anthropic.APIError && (e.status === 529 || e.status === 503)) {
      throw erreurTransitoire("Claude est surchargé. Réessayez dans un instant.");
    }
    throw e;
  }

  if (reponse.stop_reason === "refusal") {
    throw new Error("L'IA a refusé d'analyser cette image.");
  }
  if (reponse.stop_reason === "max_tokens") {
    throw erreurTransitoire("Réponse de l'IA tronquée. Réessayez.");
  }
  const sortie = reponse.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!sortie) throw erreurTransitoire("Reponse vide de l'IA. Réessayez.");
  return JSON.parse(sortie);
}

// --- ChatGPT et Mistral (meme forme d'API : "chat completions") ---------------

async function appelerChat(base, cle, modele, { image, texte, schema, temperature }, options) {
  const contenu = [{ type: "text", text: texte }];
  if (image) {
    const url = `data:image/jpeg;base64,${image}`;
    // OpenAI attend { url }, Mistral la chaine directement.
    contenu.unshift({ type: "image_url", image_url: options.imageEnChaine ? url : { url } });
  }
  const corps = {
    model: modele,
    messages: [{ role: "user", content: contenu }],
    response_format: {
      type: "json_schema",
      json_schema: { name: "reponse", strict: true, schema: versJsonSchema(schema) },
    },
  };
  // Les modeles de raisonnement d'OpenAI refusent tout reglage de temperature.
  if (options.temperature) corps.temperature = temperature;

  const MAX_ESSAIS = 3;
  let derniere = null;
  for (let essai = 1; essai <= MAX_ESSAIS; essai++) {
    let reponse;
    try {
      reponse = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${cle}` },
        body: JSON.stringify(corps),
      });
    } catch (e) {
      derniere = e.message;
      if (essai < MAX_ESSAIS) { await pause(essai * 1200); continue; }
      throw erreurTransitoire(`${options.nom} injoignable. Vérifiez votre connexion.`);
    }
    const data = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      const code = data?.error?.code || data?.error?.type || "";
      derniere = data?.error?.message || data?.message || `Erreur ${reponse.status}`;
      if (reponse.status === 401 || reponse.status === 403) {
        throw new Error(`Clé ${options.nom} refusée. Vérifiez-la dans les Paramètres.`);
      }
      if (code === "insufficient_quota") {
        throw new Error(`Crédit ${options.nom} épuisé.`);
      }
      if (reponse.status === 429 || reponse.status >= 500) {
        if (essai < MAX_ESSAIS) { await pause(essai * 1500); continue; }
        throw erreurTransitoire(`${options.nom} est surchargé. Réessayez dans un instant.`);
      }
      throw new Error(derniere);
    }
    const message = data?.choices?.[0]?.message;
    if (message?.refusal) throw new Error("L'IA a refusé d'analyser cette image.");
    const sortie = typeof message?.content === "string"
      ? message.content
      : (message?.content || []).map((c) => c.text || "").join("");
    if (!sortie) {
      derniere = "Reponse vide";
      if (essai < MAX_ESSAIS) { await pause(essai * 1200); continue; }
      throw erreurTransitoire("Reponse vide de l'IA. Réessayez.");
    }
    return JSON.parse(sortie);
  }
  throw erreurTransitoire(derniere || "Échec de l'analyse. Réessayez.");
}

const appelerOpenAI = (cle, demande) =>
  appelerChat(URL_OPENAI, cle, modeleDe("openai") || MODELE_OPENAI, demande, { nom: "ChatGPT" });

const appelerMistral = (cle, demande) =>
  appelerChat(URL_MISTRAL, cle, modeleDe("mistral") || MODELE_MISTRAL, demande,
    { nom: "Mistral", imageEnChaine: true, temperature: true });

// --- Reconnaissance d'une cle -------------------------------------------------

/**
 * Choisit le modele a utiliser parmi ceux qu'une cle donne le droit d'utiliser.
 * ChatGPT : le GPT generaliste le plus recent (pas les variantes audio, image,
 * code, recherche, ni les versions datees). Mistral : un modele qui voit les
 * images, le plus capable d'abord.
 */
export function choisirModele(id, ids) {
  if (id === "openai") {
    const EXCLUS = /audio|realtime|transcribe|tts|search|image|codex|instruct|nano|oss|chat-latest|preview|\d{4}-\d{2}-\d{2}|\d{4}$/;
    const notes = ids
      .map((m) => {
        const v = /^gpt-(\d+(?:\.\d+)?)(o)?(-mini)?$/.exec(m);
        if (!v || EXCLUS.test(m)) return null;
        // Version, puis la version complete avant la « mini ».
        return { m, note: parseFloat(v[1]) * 10 + (v[3] ? 0 : 1) };
      })
      .filter(Boolean)
      .sort((a, b) => b.note - a.note);
    return notes[0]?.m || "";
  }
  if (id === "mistral") {
    const PREFERES = ["mistral-medium-latest", "pixtral-large-latest", "mistral-small-latest", "pixtral-12b-latest"];
    return PREFERES.find((m) => ids.includes(m)) || "";
  }
  return "";
}

/** Demande la liste des modeles a une IA : "ok" (+ ids), "refusee" ou "injoignable". */
async function sonder(id, cle) {
  try {
    if (id === "claude") {
      const client = new Anthropic({ apiKey: cle, dangerouslyAllowBrowser: true, maxRetries: 1 });
      await client.models.list({ limit: 1 });
      return { etat: "ok", ids: [] };
    }
    const requete = {
      gemini: ["https://generativelanguage.googleapis.com/v1beta/models", { "x-goog-api-key": cle }],
      openai: [`${URL_OPENAI}/models`, { authorization: `Bearer ${cle}` }],
      mistral: [`${URL_MISTRAL}/models`, { authorization: `Bearer ${cle}` }],
    }[id];
    const reponse = await fetch(requete[0], { headers: requete[1] });
    if (!reponse.ok) {
      return { etat: reponse.status === 400 || reponse.status === 401 || reponse.status === 403 ? "refusee" : "injoignable" };
    }
    const data = await reponse.json().catch(() => ({}));
    return { etat: "ok", ids: (data.data || data.models || []).map((m) => m.id || m.name).filter(Boolean) };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      return { etat: "refusee" };
    }
    return { etat: "injoignable" };
  }
}

/** IA probables pour une cle, d'apres sa forme (la plus probable d'abord). */
export function devinerFournisseurs(cle) {
  if (cle.startsWith("sk-ant-")) return ["claude"];
  if (cle.startsWith("AIza") || cle.startsWith("AQ.")) return ["gemini"];
  if (cle.startsWith("sk-")) return ["openai"];
  // Pas de prefixe connu (les cles Mistral n'en ont pas) : on essaie tout.
  return ["mistral", ...IDS_FOURNISSEURS.filter((id) => id !== "mistral")];
}

/**
 * Reconnait l'IA d'une cle collee par l'utilisateur, en la verifiant aupres
 * du service. Rend { id, modele } ou leve une erreur au message lisible.
 */
export async function reconnaitreCle(brute) {
  const cle = String(brute || "").trim();
  if (!cle) throw new Error("Collez une clé API.");
  const candidats = devinerFournisseurs(cle);
  let injoignable = false;
  for (const id of candidats) {
    const r = await sonder(id, cle);
    if (r.etat === "ok") return { id, cle, modele: choisirModele(id, r.ids) };
    if (r.etat === "injoignable") injoignable = true;
  }
  if (injoignable) throw new Error("Impossible de vérifier la clé : réseau indisponible. Réessayez.");
  const noms = candidats.map((id) => FOURNISSEURS[id].nom).join(", ");
  throw new Error(`Clé refusée (${noms}). Vérifiez qu'elle est complète.`);
}

// --- Aiguillage ---------------------------------------------------------------

/**
 * Ordre dans lequel on essaie les IA qui ont une cle : Gemini d'abord (gratuit,
 * choix de l'utilisateur), puis les autres dans l'ordre de FOURNISSEURS.
 */
export function ordreIA() {
  return ["gemini", ...IDS_FOURNISSEURS.filter((id) => id !== "gemini")].filter((id) => cleDe(id));
}

const APPELS = { gemini: appelerGemini, claude: appelerClaude, openai: appelerOpenAI, mistral: appelerMistral };

/**
 * Pose une question a l'IA et rend sa reponse JSON (conforme a `schema`).
 * @param {object} demande
 * @param {string} [demande.image]  photo JPEG en base64 (facultative)
 * @param {string} demande.texte    consigne
 * @param {object} demande.schema   schema de la reponse, au format Gemini
 * @param {number} demande.temperature  0 = reproductible (Gemini et Mistral :
 *   les modeles Claude et ChatGPT actuels n'acceptent plus ce reglage)
 */
export async function appelerIA(demande) {
  const ordre = ordreIA();
  if (ordre.length === 0) {
    throw new Error(
      "Aucune clé d'IA. Ouvrez les Paramètres (roue crantée) et collez une clé " +
      `API (Gemini, Claude, ChatGPT ou Mistral). ${FOURNISSEURS.gemini.aide}`
    );
  }

  // Au moindre echec (surcharge, cle refusee, reponse illisible, refus...),
  // on passe a l'IA suivante : une autre y arrivera peut-etre. Si toutes
  // echouent, on montre ce que chacune a repondu.
  const echecs = [];
  for (const id of ordre) {
    try {
      return await APPELS[id](cleDe(id), demande);
    } catch (e) {
      echecs.push({ id, e });
      console.warn(`IA ${id} en echec, essai de la suivante :`, e.message);
    }
  }
  if (echecs.length === 1) throw echecs[0].e;
  const erreur = new Error(
    echecs.map(({ id, e }) => `${FOURNISSEURS[id].nom} : ${e.message}`).join(" — ")
  );
  erreur.transitoire = echecs.every(({ e }) => e.transitoire);
  throw erreur;
}
