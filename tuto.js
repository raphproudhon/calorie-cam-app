// Tutoriel du premier lancement, en « projecteur » : tout l'ecran est assombri
// sauf l'element presente, avec une bulle d'explication a cote.
//
// Les elements a montrer s'enregistrent eux-memes : ref={cible("id")}, ou
// cible vient de useCible(). Le tutoriel les mesure (measureInWindow) a chaque
// etape et dessine quatre bandes sombres autour du trou.
//
// Deux sortes d'etapes :
//   - explication : bouton « Suivant » ; le trou est bloque (on ne lance pas
//     une photo par megarde), sauf si libre: true (ex. : faire tourner le perso) ;
//   - action : l'utilisateur doit faire le geste lui-meme (toucher un onglet) ;
//     le trou laisse passer le doigt et l'etape avance toute seule.

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

export const ETAPES_TUTO = [
  {
    cible: "photo-actions",
    onglet: "photo",
    titre: "Analysez un repas",
    texte:
      "Prenez votre plat en photo, ou choisissez-la dans la galerie : l'IA reconnaît les aliments et estime les quantités. Les calories viennent de la table officielle Ciqual.",
  },
  {
    cible: "photo-scan",
    onglet: "photo",
    titre: "Scannez un code-barres",
    texte: "Pour un produit emballé, scannez son code-barres. Vous pouvez en enchaîner plusieurs dans la même analyse.",
  },
  {
    cible: "onglet-progression",
    titre: "Votre progression",
    texte: "Touchez l'onglet Progression.",
    attendOnglet: "progression",
  },
  {
    cible: "perso",
    onglet: "progression",
    titre: "Votre héros",
    texte: "Il évolue au fil de vos niveaux. Glissez le doigt à l'horizontale pour le faire tourner : essayez !",
    libre: true,
  },
  {
    cible: "xp",
    onglet: "progression",
    titre: "Niveau et XP",
    texte: "Vous gagnez de l'XP en suivant vos repas et votre poids. Chaque palier fait évoluer votre héros.",
  },
  {
    cible: "onglet-bilan",
    titre: "Votre journée",
    texte: "Touchez l'onglet Bilan.",
    attendOnglet: "bilan",
  },
  {
    cible: "bilan-reste",
    onglet: "bilan",
    titre: "Ce qu'il vous reste",
    texte: "Objectif + sport − ce que vous avez mangé : voilà ce qu'il vous reste à manger aujourd'hui.",
  },
  {
    cible: "bilan-sport",
    onglet: "bilan",
    titre: "Le sport compte",
    texte: "Ajoutez les calories brûlées à la main, ou importez-les depuis Apple Santé.",
  },
  {
    cible: "roue",
    titre: "Réglages",
    texte: "Objectif, poids du jour, clé API… tout se règle ici. Vous pourrez aussi y revoir ce tutoriel.",
  },
];

// --- Registre des cibles ----------------------------------------------------

const CibleCtx = createContext(() => () => {});

/** ref={cible("id")} : enregistre la vue a montrer pendant le tutoriel. */
export const useCible = () => useContext(CibleCtx);

export function FournisseurCibles({ registre, children }) {
  const cible = (id) => (noeud) => {
    if (noeud) registre.current[id] = noeud;
  };
  return <CibleCtx.Provider value={cible}>{children}</CibleCtx.Provider>;
}

// --- Le tutoriel -------------------------------------------------------------

const MARGE = 8;      // espace entre l'element et le bord du trou
const HAUT_SUR = 50;  // ne pas passer sous la barre d'etat
const SOMBRE = "rgba(8, 6, 14, 0.82)";
// Au-dessus de tout (la barre du haut a elle-meme un zIndex).
const PREMIER_PLAN = { zIndex: 100, elevation: 100 };

export function Tutoriel({ registre, onglet, setOnglet, accent, onFin }) {
  const [i, setI] = useState(0);
  const [trou, setTrou] = useState(null); // { x, y, w, h } en coordonnees fenetre
  const [hBulle, setHBulle] = useState(0); // hauteur de la bulle, pour la garder a l'ecran
  const { width: L, height: H } = useWindowDimensions();
  const etape = ETAPES_TUTO[i];
  const derniere = i === ETAPES_TUTO.length - 1;
  const origine = useRef(null); // pour ramener le trou dans le repere de l'overlay

  // Change d'onglet si l'etape le demande.
  useEffect(() => {
    if (etape.onglet && onglet !== etape.onglet) setOnglet(etape.onglet);
  }, [i]);

  // Etape « action » : avance des que l'utilisateur a touche le bon onglet.
  useEffect(() => {
    if (etape.attendOnglet && onglet === etape.attendOnglet) setI((n) => n + 1);
  }, [onglet, i]);

  // Mesure de la cible (apres le changement d'onglet, qu'elle soit affichee).
  useEffect(() => {
    setTrou(null);
    let annule = false;
    const mesurer = (essai) => {
      const noeud = registre.current[etape.cible];
      if (!noeud || !noeud.measureInWindow) return;
      noeud.measureInWindow((x, y, w, h) => {
        if (annule) return;
        if (!w || !h) {
          if (essai < 5) setTimeout(() => mesurer(essai + 1), 150);
          return;
        }
        const o = origine.current || { x: 0, y: 0 };
        setTrou({ x: x - o.x - MARGE, y: y - o.y - MARGE, w: w + 2 * MARGE, h: h + 2 * MARGE });
      });
    };
    const t = setTimeout(() => mesurer(0), 250);
    return () => { annule = true; clearTimeout(t); };
  }, [i, L, H]);

  const suivant = () => (derniere ? onFin() : setI((n) => n + 1));

  // Tant que la cible n'est pas mesuree : voile uniforme.
  if (!trou) {
    return (
      <View
        style={[StyleSheet.absoluteFill, PREMIER_PLAN, { backgroundColor: SOMBRE }]}
        ref={(r) => r?.measureInWindow?.((x, y) => { origine.current = { x, y }; })}
      />
    );
  }

  const { x, y, w, h } = trou;
  // Bulle du cote ou il y a le plus de place, puis ramenee dans l'ecran (elle
  // peut alors chevaucher un peu la cible, plutot que d'etre coupee).
  const enBas = H - (y + h) >= y;
  const hautBulle = enBas
    ? Math.min(y + h + 14, H - hBulle - 16)
    : Math.max(HAUT_SUR, y - hBulle - 14);
  const bande = { position: "absolute", backgroundColor: SOMBRE };

  return (
    <View style={[StyleSheet.absoluteFill, PREMIER_PLAN]} pointerEvents="box-none">
      {/* Quatre bandes sombres autour du trou : elles bloquent le doigt. */}
      <View style={[bande, { left: 0, top: 0, width: L, height: Math.max(0, y) }]} />
      <View style={[bande, { left: 0, top: y + h, width: L, height: Math.max(0, H - y - h) }]} />
      <View style={[bande, { left: 0, top: y, width: Math.max(0, x), height: h }]} />
      <View style={[bande, { left: x + w, top: y, width: Math.max(0, L - x - w), height: h }]} />

      {/* Contour du trou. Etape d'explication non libre : il bloque aussi le
          doigt (on ne declenche pas l'element presente par megarde). */}
      <View
        pointerEvents={etape.attendOnglet || etape.libre ? "none" : "auto"}
        style={[styles.contour, { left: x, top: y, width: w, height: h, borderColor: accent }]}
      />

      <View
        style={[styles.bulle, { top: hautBulle }]}
        onLayout={(e) => setHBulle(e.nativeEvent.layout.height)}
      >
        <Text style={styles.compteur}>{i + 1} / {ETAPES_TUTO.length}</Text>
        <Text style={styles.titre}>{etape.titre}</Text>
        <Text style={styles.texte}>{etape.texte}</Text>
        <View style={styles.boutons}>
          <Pressable onPress={onFin} hitSlop={10}>
            <Text style={styles.passer}>Passer</Text>
          </Pressable>
          {etape.attendOnglet ? (
            <Text style={[styles.consigne, { color: accent }]}>👆 À vous !</Text>
          ) : (
            <Pressable onPress={suivant} style={[styles.suivant, { backgroundColor: accent }]}>
              <Text style={styles.suivantTexte}>{derniere ? "C'est parti !" : "Suivant"}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contour: { position: "absolute", borderWidth: 2, borderRadius: 14 },
  bulle: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#24202F",
    borderRadius: 16,
    padding: 16,
  },
  compteur: { fontSize: 11, color: "#A49FAE", marginBottom: 4 },
  titre: { fontSize: 17, fontWeight: "800", color: "#EEE9F2" },
  texte: { fontSize: 14, color: "#D8D3E0", marginTop: 6, lineHeight: 20 },
  boutons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  passer: { fontSize: 14, color: "#A49FAE" },
  consigne: { fontSize: 15, fontWeight: "700" },
  suivant: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  suivantTexte: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
