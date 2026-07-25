# Contexte pour un assistant IA

Ce projet (**CalorieCam**) est décrit en détail dans le `README.md` — le lire en premier.

Points clés :

- **Expo SDK 54** (imposé par la version d'Expo Go du téléphone de test). Ne pas
  mettre à jour vers un SDK plus récent sans vérifier ce que supporte l'Expo Go
  installé. Docs de la bonne version : https://docs.expo.dev/versions/v54.0.0/
- IA vision : **Google Gemini**, modèle `gemini-flash-latest`. Le code appelle
  l'API REST directement (`fetch`) dans `gemini.js`.
- La clé API est dans `secrets.js` (exclu de Git). Ne jamais la commiter, ne
  jamais la remettre en clair dans le code.

## Règle d'architecture à ne pas casser

**L'IA n'invente aucune valeur nutritionnelle.** Elle identifie les aliments et
estime les masses ; les calories et macros viennent exclusivement de la table
Ciqual de l'ANSES (`data/ciqual.json`). Si une évolution redonne à l'IA le
calcul des calories, c'est une régression : c'est précisément le défaut que
cette version corrige.

Corollaire : l'état de cuisson compte autant que l'aliment. Le riz cru est à
350 kcal/100 g, cuit à 145 — confondre les deux fausse le résultat d'un facteur
2,4. Le scoring de `ciqual.js` et le prompt de la passe 2 traitent ce cas
explicitement.

## Fichiers

| Fichier | Rôle |
|---|---|
| `App.js` | écran unique : affichage, correction manuelle des portions |
| `gemini.js` | passe 1 (vision) et passe 2 (choix de la fiche Ciqual) |
| `ciqual.js` | recherche floue dans la table + calcul nutritionnel |
| `data/ciqual.json` | table réduite (235 Ko), **versionnée** — ne pas régénérer sans raison |
| `tools/build-ciqual.js` | conversion des XML officiels de l'ANSES vers ce JSON |

## Pièges rencontrés

- Le XML de l'ANSES est encodé en **windows-1252**, pas en UTF-8, et contient
  des `<` **non échappés** dans certains libellés — il n'est donc pas
  strictement valide. `tools/build-ciqual.js` gère les deux cas ; ne pas le
  « simplifier » avec un parseur XML standard sans vérifier.
- ~890 aliments de la table n'ont aucune valeur énergétique : ils sont exclus
  du JSON, sinon ils polluent la recherche.
- La recherche textuelle seule trouve la bonne fiche en 1ʳᵉ position dans 84 %
  des cas seulement — d'où la passe 2. Mais elle la place dans le top 8 dans
  96 % des cas, ce qui suffit pour que le modèle tranche.
