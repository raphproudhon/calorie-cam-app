// Appels aux IA vision, interchangeables.
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
// IA utilisee : celle choisie dans les Parametres (cle.js). Si elle est
// surchargee ou injoignable et qu'une cle existe pour une autre, on bascule
// dessus plutot que d'echouer.

import Anthropic from "@anthropic-ai/sdk";
import { cleDe, fournisseurActif, FOURNISSEURS, IDS_FOURNISSEURS } from "./cle";

const MODELE_GEMINI = "gemini-flash-latest";
const MODELE_CLAUDE = "claude-opus-5-5";

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

// --- Aiguillage ---------------------------------------------------------------

const APPELS = { gemini: appelerGemini, claude: appelerClaude };

/**
 * Pose une question a l'IA et rend sa reponse JSON (conforme a `schema`).
 * @param {object} demande
 * @param {string} [demande.image]  photo JPEG en base64 (facultative)
 * @param {string} demande.texte    consigne
 * @param {object} demande.schema   schema de la reponse, au format Gemini
 * @param {number} demande.temperature  0 = reproductible (Gemini seulement :
 *   les modeles Claude actuels n'acceptent plus ce reglage)
 */
export async function appelerIA(demande) {
  const choisie = fournisseurActif();
  // L'IA choisie d'abord, puis les autres pour lesquelles on a une cle.
  const ordre = [choisie, ...IDS_FOURNISSEURS.filter((id) => id !== choisie)]
    .filter((id) => cleDe(id));
  if (ordre.length === 0) {
    const f = FOURNISSEURS[choisie];
    throw new Error(
      `Aucune clé API ${f.nom}. Ouvrez les Paramètres (roue crantée) et collez ` +
      `votre clé. ${f.aide}`
    );
  }

  let erreur = null;
  for (const id of ordre) {
    try {
      return await APPELS[id](cleDe(id), demande);
    } catch (e) {
      erreur = e;
      // Cle refusee, image refusee... : une autre IA ne ferait pas mieux sur le
      // fond, et l'utilisateur doit voir le vrai message. Seules la surcharge
      // et les pannes reseau justifient de passer a la suivante.
      if (!e.transitoire) throw e;
      console.warn(`IA ${id} indisponible, essai de la suivante :`, e.message);
    }
  }
  throw erreur;
}
