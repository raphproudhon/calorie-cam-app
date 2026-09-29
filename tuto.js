// Tutoriel du premier lancement, en « projecteur » : tout l'ecran est assombri
// sauf l'element presente, avec une bulle d'explication a cote. Il fait le
// tour de toute l'app : Photo, Progression, Bilan, puis l'interieur des
// Parametres.
//
// Les elements a montrer s'enregistrent eux-memes : ref={cible("id")}, ou
// cible vient de useCible(). Les pages qui defilent s'enregistrent avec
// useDefilTuto("id") : le tutoriel les fait defiler pour amener l'element a
// l'ecran. A chaque etape, l'element est mesure (measureInWindow) et quatre
// bandes sombres sont dessinees autour du trou.
//
// Sortes d'etapes :
//   - explication : bouton « Suivant » ; l'element est bloque (on ne lance pas
//     une photo par megarde), sauf libre: true (ex. : faire tourner le perso) ;
//   - action : l'utilisateur fait le geste lui-meme (toucher un onglet, la roue
//     crantee) ; le trou laisse passer le doigt et l'etape avance toute seule ;
//   - sans cible : bulle au centre (ce qui n'est pas encore a l'ecran).
// Une main animee montre le geste attendu (geste: "appui", "glisser" ou
// "pincer").
//
// Les Parametres s'ouvrent dans une Modal, qui passe au-dessus de tout : les
// etapes zone: "params" sont donc dessinees par une seconde instance du
// tutoriel, placee dans la Modal. L'etape courante est tenue par l'App.

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

export const ETAPES_TUTO = [
  // --- Photo ---
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
    cible: null,
    onglet: "photo",
    titre: "Après l'analyse",
    texte:
      "Chaque aliment s'affiche avec son poids estimé. Touchez un poids pour le corriger, ou le nom pour choisir une autre fiche. Ajoutez d'autres produits au scanner, puis touchez « Ajouter au bilan ».",
  },
  // --- Progression ---
  {
    cible: "onglet-progression",
    titre: "Votre progression",
    texte: "Touchez l'onglet Progression.",
    attendOnglet: "progression",
    geste: "appui",
  },
  {
    cible: "perso",
    onglet: "progression",
    defil: "progression",
    titre: "Votre héros",
    texte: "Il évolue au fil de vos niveaux. Glissez le doigt à l'horizontale pour le faire tourner : essayez !",
    libre: true,
    geste: "glisser",
  },
  {
    cible: "xp",
    onglet: "progression",
    defil: "progression",
    titre: "Niveau et XP",
    texte:
      "Vous gagnez de l'XP en suivant vos repas et votre poids. Chaque palier fait évoluer votre héros ; la série compte vos jours suivis d'affilée.",
  },
  {
    cible: "badges",
    onglet: "progression",
    defil: "progression",
    titre: "Badges",
    texte: "Des récompenses à débloquer au fil de votre suivi. Celles à venir sont cadenassées.",
  },
  {
    cible: "prog-poids",
    onglet: "progression",
    defil: "progression",
    titre: "Courbe de poids",
    texte: "Votre poids dans le temps, dès deux pesées enregistrées (via la roue crantée).",
  },
  {
    cible: "prog-calories",
    onglet: "progression",
    defil: "progression",
    titre: "Historique des calories",
    texte: "Chaque journée terminée est archivée ici : ce que vous avez mangé face à votre objectif.",
  },
  // --- Bilan ---
  {
    cible: "onglet-bilan",
    titre: "Votre journée",
    texte: "Touchez l'onglet Bilan.",
    attendOnglet: "bilan",
    geste: "appui",
  },
  {
    cible: "bilan-reste",
    onglet: "bilan",
    defil: "bilan",
    titre: "Ce qu'il vous reste",
    texte: "Objectif + sport − ce que vous avez mangé : voilà ce qu'il vous reste à manger aujourd'hui.",
  },
  {
    cible: "bilan-sport",
    onglet: "bilan",
    defil: "bilan",
    titre: "Le sport compte",
    texte: "Ajoutez les calories brûlées à la main, ou importez-les depuis Apple Santé.",
  },
  {
    cible: "bilan-consomme",
    onglet: "bilan",
    defil: "bilan",
    titre: "Consommé aujourd'hui",
    texte: "Tout ce que vous ajoutez depuis l'onglet Photo s'additionne ici. La journée est archivée à minuit.",
  },
  // --- Journal ---
  {
    cible: "onglet-journal",
    titre: "Votre journal",
    texte: "Touchez l'onglet Journal.",
    attendOnglet: "journal",
    geste: "appui",
  },
  {
    cible: "journal-calendrier",
    onglet: "journal",
    titre: "Votre calendrier",
    texte:
      "Tous vos jours depuis le premier lancement, colorés selon votre objectif. Écartez deux doigts pour zoomer (année → mois → semaine → jour), rapprochez-les pour dézoomer : essayez !",
    libre: true,
    geste: "pincer",
  },
  // --- Parametres ---
  {
    cible: "roue",
    titre: "Réglages",
    texte: "Touchez la roue crantée.",
    attendParams: true,
    geste: "appui",
  },
  {
    cible: "params-objectif",
    zone: "params",
    defil: "params",
    delai: 600, // la Modal glisse encore : on attend qu'elle soit en place
    titre: "Votre objectif",
    texte: "Votre objectif calorique du jour. « Modifier » le recalcule à partir de votre profil (âge, poids, but…).",
  },
  {
    cible: "params-poids",
    zone: "params",
    defil: "params",
    titre: "Votre poids",
    texte: "Pesez-vous régulièrement : chaque pesée nourrit la courbe de poids et rapporte de l'XP.",
  },
  {
    cible: "params-journee",
    zone: "params",
    defil: "params",
    titre: "Journée en cours",
    texte: "Une erreur dans la journée ? Remettez-la à zéro ici.",
  },
  {
    cible: "params-cle",
    zone: "params",
    defil: "params",
    facultative: true, // absente quand l'app embarque deja une cle
    titre: "Clé API",
    texte: "L'analyse photo a besoin d'une clé Gemini (gratuite). Collez-la ici : elle reste sur votre téléphone.",
  },
  {
    cible: "params-sante",
    zone: "params",
    defil: "params",
    titre: "Apple Santé",
    texte: "Pour que vos calories brûlées remontent dans le Bilan.",
  },
  {
    cible: "params-tuto",
    zone: "params",
    defil: "params",
    titre: "Et voilà !",
    texte: "Vous pourrez revoir ce tutoriel ici quand vous voulez.",
  },
];

// --- Registre des cibles et des pages qui defilent -----------------------------

const RegistreCtx = createContext(null);

export function FournisseurCibles({ registre, children }) {
  return <RegistreCtx.Provider value={registre}>{children}</RegistreCtx.Provider>;
}

/** ref={cible("id")} : enregistre la vue a montrer pendant le tutoriel. */
export function useCible() {
  const registre = useContext(RegistreCtx);
  return (id) => (noeud) => {
    if (noeud && registre) registre.current[id] = noeud;
  };
}

/**
 * Props a etaler sur une ScrollView ({...defil}) pour que le tutoriel puisse
 * la faire defiler. Si la ScrollView a deja un ref ou un onScroll, appeler
 * defil.ref(n) et defil.onScroll(e) depuis les siens.
 */
export function useDefilTuto(id) {
  const registre = useContext(RegistreCtx);
  const entree = () => {
    const tous = (registre.current.__defil = registre.current.__defil || {});
    return (tous[id] = tous[id] || { y: 0, ref: null });
  };
  return {
    ref: (n) => { if (n && registre) entree().ref = n; },
    onScroll: (e) => { if (registre) entree().y = e.nativeEvent.contentOffset.y; },
    scrollEventThrottle: 16,
  };
}

// --- Le tutoriel -------------------------------------------------------------

const MARGE = 8;      // espace entre l'element et le bord du trou
const HAUT_SUR = 50;  // ne pas passer sous la barre d'etat
const HAUT_CIBLE = 140; // ou l'on amene un element a faire defiler
const SOMBRE = "rgba(8, 6, 14, 0.82)";
// Au-dessus de tout (la barre du haut a elle-meme un zIndex).
const PREMIER_PLAN = { zIndex: 100, elevation: 100 };

/** Nombre d'etapes, pour l'App (fin du tutoriel). */
export const NB_ETAPES_TUTO = ETAPES_TUTO.length;

// --- La main animee ------------------------------------------------------------

const TAILLE_DOIGT = 46;
const ANIM_NATIVE = Platform.OS !== "web"; // le driver natif n'existe pas sur le web

/**
 * Main qui mime le geste attendu, en boucle, le bout du doigt sur (x, y) :
 *   - "appui"  : le doigt s'enfonce et une onde s'elargit sous lui ;
 *   - "glisser": le doigt part de la gauche et glisse vers la droite (sur
 *     `course` px), puis s'efface et recommence ;
 *   - "pincer" : deux doigts s'ecartent depuis (x, y) (zoom avant).
 * Purement decoratif : ne capte jamais le doigt de l'utilisateur.
 */
function MainAnimee({ x, y, geste, course = 120, accent }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    t.setValue(0);
    const boucle = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: geste === "glisser" ? 1800 : 1300,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: ANIM_NATIVE,
      })
    );
    boucle.start();
    return () => boucle.stop();
  }, [geste]);

  // L'emoji 👆 a le bout du doigt en haut, un peu a gauche du centre.
  const pos = { left: x - TAILLE_DOIGT * 0.42, top: y - TAILLE_DOIGT * 0.1 };

  if (geste === "glisser") {
    const d = course / 2;
    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.main,
          pos,
          {
            opacity: t.interpolate({ inputRange: [0, 0.1, 0.7, 0.85, 1], outputRange: [0, 1, 1, 0, 0] }),
            transform: [
              { translateX: t.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [-d, -d, d, d] }) },
            ],
          },
        ]}
      >
        <Text style={styles.doigt}>👆</Text>
      </Animated.View>
    );
  }

  if (geste === "pincer") {
    // Deux doigts qui s'ecartent depuis le centre (zoom avant), en diagonale.
    const d = Math.min(course, 110) / 2;
    const opacite = t.interpolate({ inputRange: [0, 0.1, 0.7, 0.85, 1], outputRange: [0, 1, 1, 0, 0] });
    const decal = (sx, sy) => [
      { translateX: t.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [sx * 8, sx * 8, sx * d, sx * d] }) },
      { translateY: t.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [sy * 8, sy * 8, sy * d, sy * d] }) },
    ];
    return (
      <>
        <Animated.View pointerEvents="none" style={[styles.main, { left: x - TAILLE_DOIGT * 0.58, top: y - TAILLE_DOIGT * 1.1 }, { opacity: opacite, transform: decal(-1, -1) }]}>
          <Text style={styles.doigt}>👇</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.main, pos, { opacity: opacite, transform: decal(1, 1) }]}>
          <Text style={styles.doigt}>👆</Text>
        </Animated.View>
      </>
    );
  }

  // Appui : onde sous le doigt + doigt qui s'enfonce.
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.onde,
          { left: x - 22, top: y - 22, borderColor: accent },
          {
            opacity: t.interpolate({ inputRange: [0, 0.3, 0.32, 0.8, 1], outputRange: [0, 0, 0.9, 0, 0] }),
            transform: [{ scale: t.interpolate({ inputRange: [0, 0.3, 0.8, 1], outputRange: [0.3, 0.3, 1.6, 1.6] }) }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.main,
          pos,
          {
            transform: [
              { translateY: t.interpolate({ inputRange: [0, 0.3, 0.5, 1], outputRange: [10, 0, 10, 10] }) },
              { scale: t.interpolate({ inputRange: [0, 0.3, 0.5, 1], outputRange: [1, 0.86, 1, 1] }) },
            ],
          },
        ]}
      >
        <Text style={styles.doigt}>👆</Text>
      </Animated.View>
    </>
  );
}

export function Tutoriel({ zone = "app", i, setI, registre, onglet, setOnglet, paramsOuverts, accent, surAccent = "#fff", onFin }) {
  const [trou, setTrou] = useState(null); // { x, y, w, h } en coordonnees fenetre ; "centre" si sans cible
  const [hBulle, setHBulle] = useState(0); // hauteur de la bulle, pour la garder a l'ecran
  const { width: L, height: H } = useWindowDimensions();
  const etape = ETAPES_TUTO[i];
  const actif = !!etape && (etape.zone || "app") === zone;
  const derniere = i === ETAPES_TUTO.length - 1;
  const suivant = () => (derniere ? onFin() : setI(i + 1));
  const suivantRef = useRef(suivant);
  suivantRef.current = suivant;

  // Change d'onglet si l'etape le demande.
  useEffect(() => {
    if (actif && etape.onglet && onglet !== etape.onglet) setOnglet(etape.onglet);
  }, [i, actif]);

  // Etapes « action » : avancent des que le geste est fait.
  useEffect(() => {
    if (!actif) return;
    if (etape.attendOnglet && onglet === etape.attendOnglet) suivantRef.current();
    if (etape.attendParams && paramsOuverts) suivantRef.current();
  }, [onglet, paramsOuverts, i, actif]);

  // Mesure de la cible, apres le changement d'onglet (qu'elle soit affichee) ;
  // si elle est hors de l'ecran, on fait defiler sa page puis on remesure.
  useEffect(() => {
    if (!actif) return;
    setTrou(null);
    if (!etape.cible) { setTrou("centre"); return; }
    let annule = false;
    let aDefile = false;
    const mesurer = (essai) => {
      if (annule) return;
      const noeud = registre.current[etape.cible];
      if (!noeud || !noeud.measureInWindow) {
        // Cible absente : etape facultative sautee, sinon on reessaie un peu.
        if (etape.facultative || essai >= 8) { suivantRef.current(); return; }
        setTimeout(() => mesurer(essai + 1), 150);
        return;
      }
      noeud.measureInWindow((x, y, w, h) => {
        if (annule) return;
        if (!w || !h) {
          if (essai < 8) setTimeout(() => mesurer(essai + 1), 150);
          else if (etape.facultative) suivantRef.current();
          return;
        }
        const defil = etape.defil && registre.current.__defil?.[etape.defil];
        const horsEcran = y < HAUT_SUR + 40 || y + Math.min(h, H * 0.45) > H - 40;
        if (defil?.ref && horsEcran && !aDefile) {
          aDefile = true;
          defil.ref.scrollTo({ y: Math.max(0, defil.y + y - HAUT_CIBLE), animated: false });
          setTimeout(() => mesurer(essai), 250);
          return;
        }
        setTrou({ x: x - MARGE, y: y - MARGE, w: w + 2 * MARGE, h: h + 2 * MARGE });
      });
    };
    const t = setTimeout(() => mesurer(0), etape.delai || 250);
    return () => { annule = true; clearTimeout(t); };
  }, [i, actif, L, H]);

  if (!actif) return null;

  const bulle = (style) => (
    <View style={[styles.bulle, style]} onLayout={(e) => setHBulle(e.nativeEvent.layout.height)}>
      <Text style={styles.compteur}>{i + 1} / {ETAPES_TUTO.length}</Text>
      <Text style={styles.titre}>{etape.titre}</Text>
      <Text style={styles.texte}>{etape.texte}</Text>
      <View style={styles.boutons}>
        <Pressable onPress={onFin} hitSlop={10}>
          <Text style={styles.passer}>Passer</Text>
        </Pressable>
        {etape.attendOnglet || etape.attendParams ? (
          <Text style={[styles.consigne, { color: accent }]}>👆 À vous !</Text>
        ) : (
          <Pressable onPress={suivant} style={[styles.suivant, { backgroundColor: accent }]}>
            <Text style={[styles.suivantTexte, { color: surAccent }]}>{derniere ? "C'est parti !" : "Suivant"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  // Tant que la cible n'est pas mesuree : voile uniforme.
  if (!trou) {
    return <View style={[StyleSheet.absoluteFill, PREMIER_PLAN, { backgroundColor: SOMBRE }]} />;
  }

  // Etape sans cible : voile uniforme et bulle au centre.
  if (trou === "centre") {
    return (
      <View style={[StyleSheet.absoluteFill, PREMIER_PLAN, { backgroundColor: SOMBRE }]}>
        {bulle({ top: Math.max(HAUT_SUR, (H - hBulle) / 2) })}
      </View>
    );
  }

  const { x, y, w, h } = trou;
  // Bulle du cote ou il y a le plus de place, puis ramenee dans l'ecran (elle
  // peut alors chevaucher un peu la cible, plutot que d'etre coupee).
  const enBas = H - (y + h) >= y;
  // Main animee au centre de la cible ; pour un appui, elle deborde sous la
  // cible : on eloigne la bulle d'autant.
  const main = etape.geste ? { x: x + w / 2, y: y + h / 2 } : null;
  const ecart = etape.geste === "appui" && enBas ? 14 + Math.max(0, TAILLE_DOIGT + 10 - h / 2) : 14;
  const hautBulle = enBas
    ? Math.min(y + h + ecart, H - hBulle - 16)
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
        pointerEvents={etape.attendOnglet || etape.attendParams || etape.libre ? "none" : "auto"}
        style={[styles.contour, { left: x, top: y, width: w, height: h, borderColor: accent }]}
      />

      {bulle({ top: hautBulle })}

      {main ? (
        <MainAnimee x={main.x} y={main.y} geste={etape.geste} course={Math.min(w * 0.6, 160)} accent={accent} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contour: { position: "absolute", borderWidth: 2, borderRadius: 14 },
  main: { position: "absolute", width: TAILLE_DOIGT, height: TAILLE_DOIGT * 1.2 },
  doigt: {
    fontSize: TAILLE_DOIGT,
    lineHeight: TAILLE_DOIGT * 1.2,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 6,
  },
  onde: { position: "absolute", width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
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
