// Liens entrants : caloriecam://sport?kcal=450
//
// Sert au raccourci iOS (appli Raccourcis) qui lit l'energie active du jour
// dans Apple Sante et la transmet a l'app. Contournement : sans compte Apple
// Developer payant, l'app installee par sideload n'a pas l'autorisation
// HealthKit, mais Raccourcis, lui, peut lire Sante.
//
// La valeur REMPLACE le sport du jour (le raccourci envoie le total du jour) :
// relancer le raccourci met a jour, sans double comptage.

const KCAL_MAX = 10000; // garde-fou contre une valeur aberrante

/**
 * Renvoie les kcal (entier >= 0) portees par un lien "sport", ou null si le
 * lien n'en est pas un ou si la valeur est invalide. Accepte la virgule
 * decimale : Raccourcis formate les nombres selon la langue du telephone.
 */
export function kcalDepuisLien(url) {
  if (typeof url !== "string") return null;
  const m = url.match(/^caloriecam:\/\/sport\/?\?(?:.*&)?kcal=([^&#]*)/i);
  if (!m) return null;
  const brut = decodeURIComponent(m[1]).replace(/\s/g, "").replace(",", ".");
  if (brut === "") return null; // Number("") vaudrait 0
  const n = Number(brut);
  if (!Number.isFinite(n) || n < 0 || n > KCAL_MAX) return null;
  return Math.round(n);
}
