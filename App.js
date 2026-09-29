// CalorieCam — onglets :
//   - "Photo"       : photo d'un plat -> calories et macros (analyse.js/ia.js/ciqual.js)
//   - "Progression" : courbe de poids + historique des calories jour par jour
//   - "Bilan"       : calories restantes du jour (objectif + sport - consomme)
// L'objectif se regle au premier lancement (onboarding), puis via la roue
// crantee en haut a gauche (menu parametres).
//
// Repartition des roles (voir README) :
//   - analyse.js  : l'IA identifie les aliments et estime les portions
//   - ia.js       : les IA interchangeables (Gemini, Claude, ChatGPT, Mistral) ; on colle une cle, l'IA est reconnue
//   - ciqual.js   : la table officielle de l'ANSES fournit les valeurs nutritionnelles
//   - besoins.js  : calcul du besoin calorique et de l'objectif, avec garde-fous
//   - stockage.js : persistance locale (profil, historique, poids) + bascule de jour
//   - ce fichier  : l'affichage

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Polyline, Circle, Line as SvgLine } from "react-native-svg";

import { analyserPhoto, alimentsProches } from "./analyse";
import { produitParCodeBarres, analyseDepuisProduit, alimentDepuisProduit, chercherProduits } from "./off";
import { calculer, totaliser, rechercher, rechercherApprochant, correspondExacte, couverture, NB_ALIMENTS, SOURCE } from "./ciqual";
import { ACTIVITES, RYTHMES, calculerObjectif, bilanJournalier } from "./besoins";
import { estDisponible as santeDisponible, demanderAcces, depenseDuJour } from "./health";
import { chargerEtat, sauvegarderEtat, dateDuJour } from "./stockage";
import { chargerCle, definirCle, modeleDe, fournisseurActif, definirFournisseur, fournisseursDisponibles, FOURNISSEURS } from "./cle";
import { reconnaitreCle } from "./ia";
import {
  niveauDepuisXp,
  themePerso,
  BADGES,
  recompenserPesee,
  ajouterXp,
  jeuParDefaut,
  etapePersonnage,
  NB_ETAPES,
  PERSOS,
} from "./jeu";
import { SPRITES, ANIMS } from "./perso-sprites";
import { VERSION, TEST } from "./version";
import { kcalDepuisLien } from "./lien";
import { Tutoriel, FournisseurCibles, useCible, useDefilTuto } from "./tuto";
import {
  joursDuJournal,
  resumeJournal,
  NIVEAUX_CALENDRIER,
  JOURS_COURTS,
  semaineDe,
  lundiDe,
  grilleMois,
  titrePeriode,
  nomMois,
  decalerPeriode,
  niveauVoisin,
} from "./journal";

// Le theme "accent" de l'app suit le personnage : sa couleur evolue avec le
// niveau (bleu -> cramoisi -> or). Fourni par App, lu partout via useContext.
const AccentCtx = createContext("#C4622D");
const useAccent = () => useContext(AccentCtx);

// --- Racine : chargement, onboarding, navigation ---------------------------

export default function App() {
  const [etat, setEtat] = useState(null); // null = en cours de chargement
  const [onglet, setOnglet] = useState("photo");
  const [paramsOuverts, setParamsOuverts] = useState(false);
  const cibles = useRef({}); // vues montrees par le tutoriel (voir tuto.js)
  const [etapeTuto, setEtapeTuto] = useState(0);

  // Chargement de l'etat persiste (profil, historique, poids) au demarrage.
  // chargerEtat applique aussi la bascule de journee (archivage de la veille).
  useEffect(() => {
    chargerEtat().then(setEtat);
    chargerCle();
  }, []);

  // Sauvegarde a chaque modification de l'etat (une fois charge).
  useEffect(() => {
    if (etat) sauvegarderEtat(etat);
  }, [etat]);

  // Lien caloriecam://sport?kcal=N (raccourci iOS qui lit Apple Sante, voir
  // lien.js) : remplace le sport du jour et affiche le Bilan. Branche une fois
  // l'etat charge, pour ne pas ecrire dans un etat encore vide.
  const charge = etat !== null;
  useEffect(() => {
    if (!charge) return;
    const recevoir = (url) => {
      const kcal = kcalDepuisLien(url);
      if (kcal == null) return;
      setEtat((e) => ({ ...e, jour: { ...e.jour, sport: String(kcal) } }));
      setOnglet("bilan");
    };
    Linking.getInitialURL().then(recevoir).catch(() => {});
    const abonnement = Linking.addEventListener("url", ({ url }) => recevoir(url));
    return () => abonnement.remove();
  }, [charge]);

  // Palette de l'app : claire pour le Chat, sombre sinon (Necromancien, et
  // ecrans d'avant le choix du perso), avec l'accent du theme du perso pour
  // les textes et traits. A appliquer avant tout rendu.
  appliquerPalette(
    etat?.perso === "chat" ? "clair" : "sombre",
    etat?.perso ? themePerso(etat.perso, niveauDepuisXp(etat.jeu?.xp || 0).niveau).accentTexte : null
  );

  // --- Ecran d'attente pendant le chargement ---
  if (!etat) {
    return (
      <View style={[styles.ecran, styles.centreEcran]}>
        <ActivityIndicator size="large" color={COULEURS.accent} />
      </View>
    );
  }

  // --- Premier lancement : onboarding obligatoire ---
  if (!etat.profil) {
    return (
      <View style={styles.ecran}>
        <FormulaireObjectif
          titre="Bienvenue"
          sousTitre="Configurons votre objectif pour commencer."
          libelleValider="Commencer"
          onValider={(profil, objectif) =>
            setEtat((e) => ({ ...e, profil, objectif }))
          }
        />
      </View>
    );
  }

  // --- Choix du personnage (une seule fois, definitif) ---
  // Aussi montre aux utilisateurs deja installes avant l'arrivee des persos.
  if (!etat.perso) {
    return (
      <View style={styles.ecran}>
        <ChoixPerso onChoisir={(perso) => setEtat((e) => ({ ...e, perso }))} />
      </View>
    );
  }

  // --- Application principale ---
  const majJour = (champs) =>
    setEtat((e) => ({ ...e, jour: { ...e.jour, ...champs } }));

  // « Ajouter au bilan » : cumule les kcal du jour et garde le repas pour le
  // journal (heure, nom du plat, kcal).
  const ajouterConsomme = (kcal, plat) => {
    const k = Math.max(0, Math.round(kcal || 0));
    const maintenant = new Date();
    const heure = `${String(maintenant.getHours()).padStart(2, "0")}:${String(maintenant.getMinutes()).padStart(2, "0")}`;
    setEtat((e) => ({
      ...e,
      jour: {
        ...e.jour,
        consomme: (e.jour.consomme || 0) + k,
        repas: [...(e.jour.repas || []), { heure, plat: plat || "Repas", kcal: k }],
      },
    }));
  };

  // Accent + fond du theme : propres a chaque perso (voir themePerso). Pour le
  // Necromancien ils progressent avec le niveau. Le fond reste tres sombre
  // (teinte legere) pour la lisibilite.
  const niveauCourant = niveauDepuisXp((etat.jeu || {}).xp || 0).niveau;
  const { accent, fond } = themePerso(etat.perso, niveauCourant);
  // Texte pose sur l'accent (boutons, onglet actif) : fonce sur un accent pale.
  const surAccent = COULEURS.surAccent;

  const cible = (id) => (noeud) => { if (noeud) cibles.current[id] = noeud; };

  // Tutoriel : deux instances partagent l'etape courante, l'une sur l'app,
  // l'autre dans la Modal des Parametres (qui passe au-dessus de tout).
  const finTuto = () => {
    // Les pages que le tutoriel a fait defiler reviennent en haut.
    Object.values(cibles.current.__defil || {}).forEach((d) =>
      d.ref?.scrollTo({ y: 0, animated: false })
    );
    setEtat((e) => ({ ...e, tutoVu: true }));
    setParamsOuverts(false);
    setEtapeTuto(0);
  };
  const propsTuto = {
    i: etapeTuto,
    setI: setEtapeTuto,
    registre: cibles,
    onglet,
    setOnglet,
    paramsOuverts,
    accent,
    surAccent,
    onFin: finTuto,
  };

  return (
    <AccentCtx.Provider value={accent}>
    <FournisseurCibles registre={cibles}>
    <View style={[styles.ecran, { backgroundColor: fond }]}>
      <StatusBar barStyle={COULEURS.barreEtat} />
      {/* Barre du haut : roue crantee (parametres) a gauche + titre */}
      <View style={[styles.barreHaut, { backgroundColor: fond }]}>
        <Pressable
          ref={cible("roue")}
          onPress={() => setParamsOuverts(true)}
          hitSlop={14}
          style={({ pressed }) => [styles.rouePos, pressed && styles.roueAppui]}
          accessibilityRole="button"
          accessibilityLabel="Paramètres"
        >
          <Text style={styles.roue}>⚙︎</Text>
        </Pressable>
        <Text style={styles.barreTitre}>CalorieCam</Text>
      </View>

      <View style={[styles.tabs, { backgroundColor: fond }]}>
        {[
          ["photo", "Photo"],
          ["progression", "Progression"],
          ["bilan", "Bilan"],
          ["journal", "Journal"],
        ].map(([cle, libelle]) => (
          <Pressable
            key={cle}
            ref={cible("onglet-" + cle)}
            style={[styles.tab, onglet === cle && styles.tabActif, onglet === cle && { backgroundColor: accent }]}
            onPress={() => setOnglet(cle)}
          >
            <Text style={[styles.tabTexte, onglet === cle && styles.tabTexteActif]}>
              {libelle}
            </Text>
          </Pressable>
        ))}
      </View>

      {/*
        Les ecrans restent MONTES en permanence (masques avec display:"none" au
        lieu d'etre demontes) : chaque ecran garde son etat, l'analyse photo en
        cours continue meme si on change d'onglet, et son resultat reste affiche
        jusqu'a fermeture explicite.
      */}
      <View style={[styles.page, onglet !== "photo" && styles.pageCachee]}>
        <EcranPhoto onAjouterConsomme={ajouterConsomme} />
      </View>
      <View style={[styles.page, onglet !== "progression" && styles.pageCachee]}>
        <EcranProgression etat={etat} />
      </View>
      <View style={[styles.page, onglet !== "bilan" && styles.pageCachee]}>
        <EcranBilan
          objectif={etat.objectif}
          consomme={etat.jour.consomme || 0}
          sport={etat.jour.sport || ""}
          onSport={(v) => majJour({ sport: v })}
        />
      </View>
      <View style={[styles.page, onglet !== "journal" && styles.pageCachee]}>
        <EcranJournal etat={etat} />
      </View>

      <MenuParametres
        visible={paramsOuverts}
        etat={etat}
        onFermer={() => setParamsOuverts(false)}
        onModifierObjectif={(profil, objectif) =>
          setEtat((e) => ({ ...e, profil, objectif }))
        }
        onAjouterPoids={(valeur) =>
          setEtat((e) => {
            const entree = { date: dateDuJour(), valeur };
            return {
              ...e,
              poids: [...(e.poids || []), entree],
              // Recompense ludique : XP de suivi + paliers de poids.
              jeu: recompenserPesee(e.jeu, entree, e.profil?.but),
            };
          })
        }
        onResetJour={() => majJour({ consomme: 0, sport: "", repas: [] })}
        onDevXp={(m) => setEtat((e) => ({ ...e, jeu: ajouterXp(e.jeu, m) }))}
        onResetHeros={() => setEtat((e) => ({ ...e, jeu: jeuParDefaut() }))}
        onDevPerso={() => setEtat((e) => ({ ...e, perso: e.perso === "chat" ? "humain" : "chat" }))}
        onRevoirTuto={() => {
          setParamsOuverts(false);
          setOnglet("photo");
          setEtapeTuto(0);
          setEtat((e) => ({ ...e, tutoVu: false }));
        }}
        tuto={!etat.tutoVu ? <Tutoriel zone="params" {...propsTuto} /> : null}
      />

      {/* Tutoriel du premier lancement (et « Revoir le tutoriel »). */}
      {!etat.tutoVu ? <Tutoriel zone="app" {...propsTuto} /> : null}
    </View>
    </FournisseurCibles>
    </AccentCtx.Provider>
  );
}

// Deux palettes : sombre (Necromancien, et ecrans d'avant le choix du perso)
// et claire (Chat celeste : blanc, rose pale, vert pale). COULEURS est
// l'objet vivant lu partout ; appliquerPalette() le remplit et recalcule la
// feuille de styles (voir creerStyles, en bas du fichier).
const PALETTES = {
  sombre: {
    fond: "#17151F",
    accent: "#C4622D",     // accent des textes, traits et courbes
    secondaire: "#363143", // boutons secondaires
    texte: "#EEE9F2",
    doux: "#A49FAE",
    carte: "#221E2C",
    bord: "#332F3D",
    piste: "#2A2636",      // fond des barres, segments, options
    surAccent: "#FFFFFF",  // texte pose sur un bouton ou un onglet colore
    rouge: "#FF6B6B",
    vert: "#58D08A",
    scan: "#4A7C59",
    supprimer: "#B00020",
    erreurFond: "#3A2126",
    avertFond: "#3A2F1E",
    avertBord: "#574326",
    avertTexte: "#E7C883",
    appui: "rgba(255,255,255,0.12)",
    scene: "#161320",
    fantome: "#ffffff88",
    barreEtat: "light-content",
  },
  clair: {
    fond: "#FFF9FB",
    accent: "#C2567A",     // rose soutenu : lisible en texte sur blanc
    secondaire: "#E3F2E6", // vert pale
    texte: "#3B2F36",
    doux: "#8C7F86",
    carte: "#FFFFFF",
    bord: "#F3D9E2",
    piste: "#F4E6EC",
    surAccent: "#3B2F36",  // texte fonce sur le rose pale
    rouge: "#D9485F",
    vert: "#3E9C63",
    scan: "#CDEBD5",
    supprimer: "#C0304A",
    erreurFond: "#FDE7EA",
    avertFond: "#FFF4DE",
    avertBord: "#F2D8A7",
    avertTexte: "#7A5A12",
    appui: "rgba(0,0,0,0.06)",
    scene: "#FFF1F5",
    fantome: "#00000055",
    barreEtat: "dark-content",
  },
};

const COULEURS = { ...PALETTES.sombre };
let paletteActive = "sombre";

/**
 * Active une palette ("sombre" | "clair") et la couleur d'accent des textes,
 * traits et courbes (celle du theme du perso) : COULEURS et styles suivent.
 */
function appliquerPalette(nom, accentTexte) {
  const cle = nom + (accentTexte || "");
  if (cle === paletteActive) return;
  paletteActive = cle;
  Object.assign(COULEURS, PALETTES[nom], accentTexte ? { accent: accentTexte } : {});
  styles = creerStyles();
}

// Le code de confiance de l'ANSES (A a D) indique la fiabilite de la donnee
// nutritionnelle elle-meme. On l'expose : l'utilisateur doit pouvoir distinguer
// une valeur solide d'une valeur indicative.
const LIBELLE_CONFIANCE = {
  A: "donnée très fiable",
  B: "donnée fiable",
  C: "donnée peu précise",
  D: "donnée indicative",
};

function EcranPhoto({ onAjouterConsomme }) {
  const accent = useAccent();
  const cible = useCible();
  const [etape, setEtape] = useState(null); // texte affiche pendant le chargement
  const [analyse, setAnalyse] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [editionFiche, setEditionFiche] = useState(null); // index de l'aliment en cours de correction
  const [ajoute, setAjoute] = useState(false); // ce plat a-t-il ete envoye au bilan ?
  const [scanOuvert, setScanOuvert] = useState(false);
  const [rechercheOuverte, setRechercheOuverte] = useState(false); // ajout d'un aliment a la main
  const [scanMsg, setScanMsg] = useState(null); // banniere dans la camera : { texte, type }
  const [permCam, demanderPermCam] = useCameraPermissions();
  const scanEnCours = useRef(false); // onBarcodeScanned se declenche en rafale

  // Codes-barres deja presents, tenus a jour hors du cycle de rendu pour que la
  // detection de doublon reste fiable meme entre deux scans rapproches.
  const codesRef = useRef(new Set());
  useEffect(() => {
    codesRef.current = new Set(
      (analyse?.aliments || []).map((al) => al.fiche?.code).filter(Boolean)
    );
  }, [analyse]);

  async function ouvrirScanner(ajouter = false) {
    setErreur(null);
    setScanMsg(null);
    if (!permCam?.granted) {
      const r = await demanderPermCam();
      if (!r.granted) {
        setErreur("Accès à la caméra refusé.");
        return;
      }
    }
    if (!ajouter) setAnalyse(null); // "Scanner" (sans +) repart d'une liste vide
    scanEnCours.current = false;
    setScanOuvert(true);
  }

  async function surCodeScanne({ data }) {
    if (scanEnCours.current) return; // rafales : ne traiter qu'un scan a la fois
    scanEnCours.current = true;
    try {
      const fiche = await produitParCodeBarres(data);
      if (!fiche) {
        setScanMsg({ texte: "Produit introuvable, réessayez.", type: "warn" });
        return; // on reste dans la camera
      }
      if (codesRef.current.has(fiche.code)) {
        setScanMsg({ texte: `Déjà scanné : ${fiche.nom}`, type: "warn" });
        return; // doublon : message en haut, la camera reste ouverte
      }
      // Nouveau produit : on l'ajoute et on ferme la camera.
      codesRef.current.add(fiche.code);
      setAnalyse((a) =>
        a
          ? { ...a, aliments: [...a.aliments, alimentDepuisProduit(fiche)] }
          : analyseDepuisProduit(fiche)
      );
      setAjoute(false); // le total a change : il faudra re-ajouter au bilan
      setScanMsg(null);
      setScanOuvert(false);
    } catch (e) {
      setScanMsg({ texte: "Erreur : " + e.message, type: "warn" });
    } finally {
      // Re-autorise un scan apres un court delai (evite de traiter 10x le meme code).
      setTimeout(() => {
        scanEnCours.current = false;
      }, 1200);
    }
  }

  async function lancer(source) {
    const options = { base64: true, quality: 0.5, allowsEditing: false };
    let res;
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setErreur("Accès à l'appareil photo refusé.");
        return;
      }
      res = await ImagePicker.launchCameraAsync(options);
    } else {
      res = await ImagePicker.launchImageLibraryAsync(options);
    }
    // Si l'utilisateur annule, on ne touche a rien : le resultat precedent reste
    // affiche (il ne disparait que via le bouton Fermer ou une nouvelle analyse).
    if (res.canceled) return;

    // Une photo a bien ete prise : on remplace le resultat precedent.
    setErreur(null);
    setAnalyse(null);
    setEtape("Analyse de la photo…");
    try {
      const resultat = await analyserPhoto(res.assets[0].base64);
      // L'identifiant sert de cle de rendu : sans lui, React reutiliserait les
      // lignes de l'analyse precedente et leurs champs de poids garderaient les
      // valeurs de la photo d'avant.
      setAnalyse({ ...resultat, id: Date.now() });
      setAjoute(false); // nouveau plat : pas encore envoye au bilan
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEtape(null);
    }
  }

  /** Modifie un aliment de l'analyse en cours (portion ou fiche CIQUAL). */
  function modifierAliment(index, champs) {
    setAnalyse((a) => {
      if (!a) return a;
      const aliments = a.aliments.map((al, i) => (i === index ? { ...al, ...champs } : al));
      return { ...a, aliments };
    });
  }

  /**
   * Ajoute a la main un aliment choisi dans la table Ciqual : sans IA ni
   * code-barres, l'app reste utilisable pour un aliment simple.
   */
  function ajouterAlimentManuel(fiche) {
    const aliment = {
      nom: fiche.nom,
      requete: "",
      grammes: 100, // point de depart, l'utilisateur ajuste
      grammesMin: 0,
      grammesMax: 0,
      baseEstimation: "",
      confiance: "",
      fiche,
      candidates: [fiche],
    };
    setErreur(null);
    setAnalyse((a) =>
      a
        ? { ...a, aliments: [...a.aliments, aliment] }
        : { plat: "Mon repas", remarques: "", aliments: [aliment], id: Date.now() }
    );
    setAjoute(false); // le total a change
  }

  /** Retire un aliment de l'analyse en cours. */
  function supprimerAliment(index) {
    setAnalyse((a) => {
      if (!a) return a;
      return { ...a, aliments: a.aliments.filter((_, i) => i !== index) };
    });
    setAjoute(false); // le total change
  }

  // Recalcul a chaque changement de portion ou de fiche.
  const portions = useMemo(() => {
    if (!analyse) return [];
    return analyse.aliments.map((al) =>
      al.fiche ? calculer(al.fiche, al.grammes) : null
    );
  }, [analyse]);

  const totaux = useMemo(() => totaliser(portions.filter(Boolean)), [portions]);

  return (
    <View style={styles.ecran}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>CalorieCam</Text>
        <Text style={styles.sousTitre}>
          Valeurs nutritionnelles issues de la table Ciqual de l'ANSES
          {" "}({NB_ALIMENTS} aliments)
        </Text>

        <View ref={cible("photo-actions")}>
          <TouchableOpacity style={[styles.bouton, { backgroundColor: accent }]} onPress={() => lancer("camera")}>
            <Text style={styles.boutonTexte}>Prendre une photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bouton, styles.boutonSecondaire]}
            onPress={() => lancer("galerie")}
          >
            <Text style={styles.boutonTexte}>Choisir dans la galerie</Text>
          </TouchableOpacity>
        </View>
        <View ref={cible("photo-scan")}>
          <TouchableOpacity
            style={[styles.bouton, styles.boutonScan]}
            onPress={() => ouvrirScanner(false)}
          >
            <Text style={styles.boutonTexte}>Scanner un code-barres</Text>
          </TouchableOpacity>
        </View>
        <View ref={cible("photo-recherche")}>
          <TouchableOpacity
            style={[styles.bouton, styles.boutonSecondaire]}
            onPress={() => setRechercheOuverte(true)}
          >
            <Text style={styles.boutonTexte}>Chercher un aliment</Text>
          </TouchableOpacity>
        </View>

        {etape && (
          <View style={styles.centre}>
            <ActivityIndicator size="large" color={COULEURS.accent} />
            <Text style={styles.info}>{etape}</Text>
          </View>
        )}

        {erreur && <Text style={styles.erreur}>Erreur : {erreur}</Text>}

        {analyse && (
          <View style={styles.carte}>
            <Text style={[styles.plat, { marginBottom: 14 }]}>{analyse.plat}</Text>

            {analyse.aliments.map((al, i) => (
              <LigneAliment
                key={`${analyse.id}-${i}`}
                aliment={al}
                portion={portions[i]}
                onGrammes={(g) => modifierAliment(i, { grammes: g })}
                onOuvrirFiches={() => setEditionFiche(i)}
                onSupprimer={
                  analyse.aliments.length > 1 ? () => supprimerAliment(i) : null
                }
              />
            ))}

            <TouchableOpacity
              style={styles.boutonAjoutScan}
              onPress={() => ouvrirScanner(true)}
            >
              <Text style={styles.boutonAjoutScanTexte}>
                + Scanner un autre produit
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.boutonAjoutScan}
              onPress={() => setRechercheOuverte(true)}
            >
              <Text style={styles.boutonAjoutScanTexte}>
                + Ajouter un aliment
              </Text>
            </TouchableOpacity>

            <View style={styles.separateur} />

            <View style={styles.ligneTotal}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalKcal}>{totaux.kcal} kcal</Text>
            </View>
            <Text style={styles.macros}>
              Protéines {totaux.prot} g · Glucides {totaux.gluc} g · Lipides{" "}
              {totaux.lip} g
            </Text>
            <Text style={styles.macrosSecondaires}>
              dont sucres {totaux.sucres} g · fibres {totaux.fibres} g · sel{" "}
              {totaux.sel} g
            </Text>

            {analyse.remarques ? (
              <Text style={styles.remarques}>{analyse.remarques}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.bouton, !ajoute && { backgroundColor: accent }, ajoute && styles.boutonSecondaire, { marginTop: 16 }]}
              onPress={() => {
                if (ajoute) return;
                onAjouterConsomme?.(totaux.kcal, analyse.plat);
                setAjoute(true);
              }}
              disabled={ajoute}
            >
              <Text style={styles.boutonTexte}>
                {ajoute ? "✓ Ajouté au bilan" : `Ajouter au bilan (${totaux.kcal} kcal)`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.boutonFermer}
              onPress={() => {
                setAnalyse(null);
                setAjoute(false);
              }}
            >
              <Text style={styles.boutonFermerTexte}>Fermer</Text>
            </TouchableOpacity>

            <Text style={styles.source}>{SOURCE}</Text>
          </View>
        )}
      </ScrollView>

      <ChoixFiche
        visible={editionFiche !== null}
        aliment={editionFiche !== null ? analyse?.aliments[editionFiche] : null}
        onChoisir={(fiche) => {
          modifierAliment(editionFiche, { fiche });
          setEditionFiche(null);
        }}
        onFermer={() => setEditionFiche(null)}
      />

      <ChoixFiche
        visible={rechercheOuverte}
        aliment={rechercheOuverte ? AJOUT_MANUEL : null}
        onChoisir={(fiche) => {
          ajouterAlimentManuel(fiche);
          setRechercheOuverte(false);
        }}
        onFermer={() => setRechercheOuverte(false)}
      />

      <Modal
        visible={scanOuvert}
        animationType="slide"
        onRequestClose={() => setScanOuvert(false)}
      >
        <View style={styles.scanEcran}>
          <CameraView
            style={styles.scanCamera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
            }}
            onBarcodeScanned={scanOuvert ? surCodeScanne : undefined}
          />
          {scanMsg ? (
            <View
              style={[
                styles.scanBanniere,
                scanMsg.type === "warn"
                  ? styles.scanBanniereWarn
                  : styles.scanBanniereOk,
              ]}
            >
              <Text style={styles.scanBanniereTexte}>{scanMsg.texte}</Text>
            </View>
          ) : null}
          <View style={styles.scanBas}>
            <Text style={styles.scanTexte}>Visez le code-barres du produit</Text>
            <TouchableOpacity
              style={styles.scanAnnuler}
              onPress={() => setScanOuvert(false)}
            >
              <Text style={styles.boutonTexte}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Une ligne d'aliment : poids modifiable, fiche CIQUAL, calories calculees. */
function LigneAliment({ aliment, portion, onGrammes, onOuvrirFiches, onSupprimer }) {
  const [saisie, setSaisie] = useState(String(aliment.grammes));

  // Resynchronise le champ quand l'aliment sous cette ligne change (ex : apres
  // suppression, l'index de rendu est reutilise pour un autre aliment).
  useEffect(() => {
    setSaisie(String(aliment.grammes));
  }, [aliment.grammes]);

  // L'incertitude annoncee par l'IA n'est affichee que si elle est reelle :
  // une fourchette large est un signal utile, une fourchette nulle du bruit.
  const fourchette =
    aliment.grammesMax > aliment.grammesMin
      ? `${aliment.grammesMin}–${aliment.grammesMax} g estimés`
      : null;

  function validerSaisie(texte) {
    setSaisie(texte);
    const g = parseInt(texte.replace(/[^0-9]/g, ""), 10);
    onGrammes(Number.isFinite(g) ? g : 0);
  }

  return (
    <View style={styles.ligneAliment}>
      <View style={styles.colGauche}>
        <Text style={styles.alimentNom}>{aliment.nom}</Text>

        <Pressable onPress={onOuvrirFiches} hitSlop={6}>
          <Text style={styles.ficheNom} numberOfLines={2}>
            {aliment.fiche ? aliment.fiche.nom : "Aucune fiche trouvée"}
            <Text style={styles.chevron}>  ▾</Text>
          </Text>
        </Pressable>

        {aliment.fiche && LIBELLE_CONFIANCE[aliment.fiche.conf] ? (
          <Text style={styles.meta}>{LIBELLE_CONFIANCE[aliment.fiche.conf]}</Text>
        ) : null}

        {fourchette ? <Text style={styles.meta}>{fourchette}</Text> : null}

        {aliment.baseEstimation ? (
          <Text style={styles.base}>{aliment.baseEstimation}</Text>
        ) : null}
      </View>

      <View style={styles.colDroite}>
        <View style={styles.champPoids}>
          <TextInput
            style={styles.saisie}
            value={saisie}
            onChangeText={validerSaisie}
            keyboardType="number-pad"
            selectTextOnFocus
            maxLength={4}
          />
          <Text style={styles.unite}>g</Text>
        </View>
        <Text style={styles.alimentKcal}>
          {portion ? `${portion.kcal} kcal` : "—"}
        </Text>
        {onSupprimer ? (
          <Pressable onPress={onSupprimer} hitSlop={8}>
            <Text style={styles.supprimer}>✕ retirer</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Selection manuelle de la fiche CIQUAL.
 * Indispensable : meme avec le reranking, un aliment sur cinq environ merite
 * d'etre requalifie a la main (plats composes, preparations regionales…).
 */
// Pseudo-aliment passe a ChoixFiche pour un ajout a la main : pas de candidates,
// la liste se remplit des qu'on tape.
const AJOUT_MANUEL = { nom: "Ajouter un aliment", candidates: [], fiche: null };

function ChoixFiche({ visible, aliment, onChoisir, onFermer }) {
  const [recherche, setRecherche] = useState("");
  const q = recherche.trim();

  // Ciqual d'abord (local, instantane). Si l'aliment exact n'y est pas (une
  // marque, une faute de frappe...), on propose le plus proche.
  const { liste, exacte } = useMemo(() => {
    if (!aliment) return { liste: [], exacte: true };
    // Tant que l'utilisateur n'a rien tape, on montre les candidates deja
    // calculees ; des qu'il tape, on cherche dans toute la table.
    if (q.length < 2) return { liste: aliment.candidates, exacte: true };
    const trouves = rechercher(q, 25);
    if (trouves.length && correspondExacte(q, trouves[0])) return { liste: trouves, exacte: true };
    // Recherche normale + tolerante aux fautes de frappe, classees par nombre
    // de mots retrouves (a egalite, l'ordre de la recherche normale).
    const vus = new Set();
    const approchants = [...trouves, ...rechercherApprochant(q, 10)]
      .filter((f) => !vus.has(f.code) && vus.add(f.code))
      .map((f, i) => ({ f, i, c: couverture(q, f) }))
      .sort((a, b) => b.c - a.c || a.i - b.i)
      .map((x) => x.f);
    return { liste: approchants.slice(0, 15), exacte: false };
  }, [aliment, q]);

  // Pas d'aliment exact : produits de marque (Open Food Facts) et aliment
  // generique le plus proche selon l'IA. En reseau, donc apres une courte
  // pause de frappe, et gardes en memoire (OFF limite le nombre de recherches).
  const [marques, setMarques] = useState(null); // null = pas cherche, "..." = en cours, [] = rien
  const [proches, setProches] = useState(null);
  const cache = useRef(new Map());
  useEffect(() => {
    setMarques(null);
    setProches(null);
    if (exacte || q.length < 3) return;
    let annule = false;
    const lancer = (cle, promesse, poser) => {
      const k = cle + ":" + q.toLowerCase();
      if (cache.current.has(k)) { poser(cache.current.get(k)); return; }
      poser("...");
      promesse()
        .then((r) => { cache.current.set(k, r); if (!annule) poser(r); })
        // L'erreur est montree (cle refusee, IA surchargee...) : sans elle,
        // « pas de suggestion » ne dit pas pourquoi. Pas mise en cache.
        .catch((e) => { if (!annule) poser({ erreur: e.message }); });
    };
    const t = setTimeout(() => {
      lancer("off", () => chercherProduits(q), setMarques);
      if (fournisseursDisponibles().length) lancer("ia", () => alimentsProches(q), setProches);
    }, 800);
    return () => { annule = true; clearTimeout(t); };
  }, [q, exacte]);

  const choisir = (f) => {
    setRecherche("");
    onChoisir(f);
  };

  const option = (f) => {
    const actif = aliment?.fiche?.code === f.code;
    return (
      <Pressable key={f.code} style={[styles.option, actif && styles.optionActive]} onPress={() => choisir(f)}>
        <Text style={styles.optionNom}>{f.nom}</Text>
        <Text style={styles.optionMeta}>
          {f.kcal} kcal/100 g · P {f.prot ?? "?"} · G {f.gluc ?? "?"} · L{" "}
          {f.lip ?? "?"}
          {f.groupe ? ` · ${f.groupe}` : ""}
          {f.quantite ? ` · ${f.quantite}` : ""}
        </Text>
      </Pressable>
    );
  };

  const section = (titre, valeur, vide) => (
    <>
      <Text style={styles.choixSection}>{titre}</Text>
      {valeur === "..." ? (
        <ActivityIndicator style={{ marginVertical: 12 }} color={COULEURS.accent} />
      ) : valeur.erreur ? (
        <Text style={styles.vide}>Indisponible : {valeur.erreur}</Text>
      ) : valeur.length ? (
        valeur.map(option)
      ) : (
        <Text style={styles.vide}>{vide}</Text>
      )}
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onFermer}>
      <View style={styles.modale}>
        <View style={styles.modaleEntete}>
          <Text style={styles.modaleTitre} numberOfLines={1}>
            {aliment ? aliment.nom : ""}
          </Text>
          <Pressable onPress={onFermer} hitSlop={10}>
            <Text style={styles.fermer}>Fermer</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.champRecherche}
          value={recherche}
          onChangeText={setRecherche}
          placeholder="Chercher un aliment ou un produit…"
          placeholderTextColor={COULEURS.doux}
          autoCorrect={false}
        />

        <ScrollView keyboardShouldPersistTaps="handled">
          {exacte ? (
            liste.length === 0 ? (
              <Text style={styles.vide}>
                {q.length < 2
                  ? "Tapez le nom d'un aliment, avec sa cuisson (ex. « riz blanc cuit »), ou d'un produit (ex. « Kinder Bueno »)."
                  : "Aucun aliment trouvé."}
              </Text>
            ) : (
              liste.map(option)
            )
          ) : (
            <>
              <Text style={styles.vide}>« {q} » n'est pas tel quel dans la table Ciqual : voici le plus proche.</Text>
              {marques !== null ? section("Produits de marque (Open Food Facts)", marques, "Aucun produit trouvé.") : null}
              {proches !== null ? section("Le plus proche selon l'IA (Ciqual)", proches, "Pas de suggestion.") : null}
              {section("Approchant dans la table Ciqual", liste, "Rien d'approchant.")}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// =========================================================================
//  ECRAN OBJECTIF — calculateur de besoin calorique
// =========================================================================

const BUTS = [
  ["perte", "Perdre du poids"],
  ["maintien", "Maintenir"],
  ["prise", "Prendre du muscle"],
];

// Formulaire de profil + objectif. Reutilise a deux endroits : l'onboarding du
// premier lancement, et le menu parametres ("modifier mon objectif"). On saisit
// le profil, on calcule, on voit le resultat, puis on valide (onValider remonte
// le profil complet et l'objectif calcule au parent, qui les persiste).
function FormulaireObjectif({ profilInitial, titre, sousTitre, libelleValider = "Enregistrer", onValider }) {
  const accent = useAccent();
  const [sexe, setSexe] = useState(profilInitial?.sexe ?? "homme");
  const [age, setAge] = useState(profilInitial?.age != null ? String(profilInitial.age) : "");
  const [poids, setPoids] = useState(profilInitial?.poids != null ? String(profilInitial.poids) : "");
  const [taille, setTaille] = useState(profilInitial?.taille != null ? String(profilInitial.taille) : "");
  const [activite, setActivite] = useState(profilInitial?.activite ?? "modere");
  const [but, setBut] = useState(profilInitial?.but ?? "perte");
  const [rythme, setRythme] = useState(profilInitial?.rythme ?? "standard");
  const [resultat, setResultat] = useState(null);
  const [profilValide, setProfilValide] = useState(null);
  const [erreurs, setErreurs] = useState([]);

  function calculer() {
    const profil = {
      sexe,
      age: parseInt(age, 10),
      poids: parseFloat(String(poids).replace(",", ".")),
      taille: parseFloat(String(taille).replace(",", ".")),
    };
    const r = calculerObjectif(profil, but, activite, rythme);
    if (!r.ok) {
      setErreurs(r.erreurs);
      setResultat(null);
      setProfilValide(null);
    } else {
      setErreurs([]);
      setResultat(r);
      // On memorise le profil complet (avec but/rythme/activite) qui a produit
      // ce resultat, pour le persister tel quel a la validation.
      setProfilValide({ ...profil, activite, but, rythme });
    }
  }

  // Les rythmes n'ont de sens que pour perte / prise.
  const rythmesDispo = but === "maintien" ? null : RYTHMES[but];

  return (
    <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
      <Text style={styles.titre}>{titre}</Text>
      <Text style={styles.sousTitre}>{sousTitre}</Text>

      <View style={styles.carte}>
        <Text style={styles.champLabel}>Sexe</Text>
        <Segment
          options={[["homme", "Homme"], ["femme", "Femme"]]}
          valeur={sexe}
          onChange={setSexe}
        />

        <View style={styles.ligneChamps}>
          <ChampNombre label="Âge" valeur={age} onChange={setAge} unite="ans" />
          <ChampNombre label="Poids" valeur={poids} onChange={setPoids} unite="kg" />
          <ChampNombre label="Taille" valeur={taille} onChange={setTaille} unite="cm" />
        </View>

        <Text style={styles.champLabel}>Niveau d'activité (indicatif)</Text>
        <Text style={styles.noteChamp}>
          N'entre pas dans le calcul : la dépense de sport est comptée à part,
          via Apple Santé, dans l'onglet Bilan.
        </Text>
        {ACTIVITES.map((a) => (
          <Pressable
            key={a.cle}
            style={[styles.optionActivite, activite === a.cle && styles.optionActiviteActive]}
            onPress={() => setActivite(a.cle)}
          >
            <Text style={[styles.optionActiviteTexte, activite === a.cle && styles.optionActiviteTexteActif]}>
              {a.libelle}
            </Text>
          </Pressable>
        ))}

        <Text style={[styles.champLabel, { marginTop: 18 }]}>Objectif</Text>
        <Segment options={BUTS} valeur={but} onChange={setBut} colonne />

        {rythmesDispo && (
          <>
            <Text style={[styles.champLabel, { marginTop: 18 }]}>Rythme</Text>
            <Segment
              options={rythmesDispo.map((r) => [r.cle, `${r.libelle}`])}
              valeur={rythme}
              onChange={setRythme}
            />
            <Text style={styles.rythmeApercu}>
              {rythmesDispo.find((r) => r.cle === rythme)?.apercu}
            </Text>
          </>
        )}

        <TouchableOpacity style={[styles.bouton, { marginTop: 20, backgroundColor: accent }]} onPress={calculer}>
          <Text style={styles.boutonTexte}>Calculer mon besoin</Text>
        </TouchableOpacity>

        {erreurs.length > 0 && (
          <View style={styles.blocErreurs}>
            {erreurs.map((e, i) => (
              <Text key={i} style={styles.erreurLigne}>• {e}</Text>
            ))}
          </View>
        )}
      </View>

      {resultat && <ResultatObjectif r={resultat} />}

      {resultat && (
        <TouchableOpacity
          style={[styles.bouton, { marginTop: 4, marginBottom: 20, backgroundColor: accent }]}
          onPress={() => onValider?.(profilValide, resultat.objectif)}
        >
          <Text style={styles.boutonTexte}>{libelleValider}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// =========================================================================
//  MENU PARAMETRES — roue crantee : objectif, poids, reset, Apple Sante
// =========================================================================

// IA vision : on colle une cle, n'importe laquelle (Gemini, Claude, ChatGPT,
// Mistral) ; reconnaitreCle devine l'IA et la verifie aupres du service. Les
// versions publiees n'embarquent aucune cle : elle reste sur l'appareil et
// n'est envoyee qu'a l'IA concernee.
function CarteIA() {
  const [choisie, setChoisie] = useState(fournisseurActif());
  const [saisie, setSaisie] = useState("");
  const [message, setMessage] = useState(null);
  const [verif, setVerif] = useState(false);
  const [, rafraichir] = useState(0);
  const dispo = fournisseursDisponibles();
  // L'IA choisie n'a plus de cle : c'est la 1re disponible qui sert.
  const utilisee = dispo.includes(choisie) ? choisie : dispo[0];

  async function choisir(id) {
    await definirFournisseur(id);
    setChoisie(id);
  }

  async function ajouter() {
    setVerif(true);
    setMessage(null);
    try {
      const { id, cle, modele } = await reconnaitreCle(saisie);
      await definirCle(id, cle, modele);
      await choisir(id);
      setSaisie("");
      setMessage(`Clé ${FOURNISSEURS[id].nom} reconnue : c'est elle qui analyse vos photos.`);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setVerif(false);
    }
  }

  async function retirer(id) {
    await definirCle(id, "");
    setMessage(`Clé ${FOURNISSEURS[id].nom} retirée.`);
    rafraichir((n) => n + 1);
  }

  return (
    <View style={styles.carte}>
      <Text style={styles.champLabel}>Intelligence artificielle</Text>
      {dispo.length ? (
        dispo.map((id) => (
          <View key={id} style={styles.iaLigne}>
            <Pressable style={{ flex: 1 }} onPress={() => choisir(id)}>
              <Text style={styles.iaNom}>
                {id === utilisee ? "● " : "○ "}
                {FOURNISSEURS[id].nom}
                {modeleDe(id) ? <Text style={styles.disclaimer}>  {modeleDe(id)}</Text> : null}
              </Text>
            </Pressable>
            <TouchableOpacity onPress={() => retirer(id)}>
              <Text style={styles.iaRetirer}>Retirer</Text>
            </TouchableOpacity>
          </View>
        ))
      ) : (
        <Text style={styles.objectifDetail}>Aucune clé : l'analyse photo est indisponible.</Text>
      )}
      {dispo.length > 1 ? (
        <Text style={styles.disclaimer}>
          Touchez une IA pour l'utiliser. Si elle est surchargée, une autre prend le relais.
        </Text>
      ) : null}
      <View style={[styles.champNombreBoite, { marginTop: 10 }]}>
        <TextInput
          style={styles.champNombreSaisie}
          value={saisie}
          onChangeText={setSaisie}
          placeholder="Coller une clé API"
          placeholderTextColor={COULEURS.doux}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
      </View>
      <TouchableOpacity
        style={[styles.bouton, styles.boutonSecondaire, { marginTop: 10 }, (verif || !saisie.trim()) && styles.boutonInactif]}
        onPress={ajouter}
        disabled={verif || !saisie.trim()}
      >
        <Text style={styles.boutonTexte}>{verif ? "Vérification…" : "Ajouter la clé"}</Text>
      </TouchableOpacity>
      {message ? <Text style={styles.objectifDetail}>{message}</Text> : null}
      <Text style={styles.disclaimer}>
        Gemini, Claude, ChatGPT ou Mistral : l'app reconnaît la clé toute seule. {FOURNISSEURS.gemini.aide} La clé reste sur cet appareil.
      </Text>
    </View>
  );
}

function MenuParametres({ visible, etat, onFermer, onModifierObjectif, onAjouterPoids, onResetJour, onDevXp, onResetHeros, onDevPerso, onRevoirTuto, tuto }) {
  const accent = useAccent();
  const cible = useCible();
  const defil = useDefilTuto("params");
  const [vue, setVue] = useState("menu"); // menu | objectif
  const [poidsSaisi, setPoidsSaisi] = useState("");
  const [dispoSante] = useState(() => santeDisponible());
  const [messageSante, setMessageSante] = useState(null);

  // A la fermeture, on revient toujours au menu principal pour la prochaine fois.
  function fermer() {
    setVue("menu");
    setPoidsSaisi("");
    setMessageSante(null);
    onFermer();
  }

  const dernierPoids =
    etat.poids && etat.poids.length ? etat.poids[etat.poids.length - 1] : null;

  async function reconnecterSante() {
    setMessageSante("Connexion…");
    try {
      await demanderAcces();
      setMessageSante("Autorisation Apple Santé demandée.");
    } catch (e) {
      setMessageSante(e.message);
    }
  }

  function validerPoids() {
    const v = parseFloat(String(poidsSaisi).replace(",", "."));
    if (Number.isFinite(v) && v > 20 && v < 400) {
      onAjouterPoids(Math.round(v * 10) / 10);
      setPoidsSaisi("");
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={fermer}>
      <View style={styles.modale}>
        <View style={styles.modaleEntete}>
          <Text style={styles.modaleTitre}>
            {vue === "objectif" ? "Modifier l'objectif" : "Paramètres"}
          </Text>
          <Pressable onPress={vue === "objectif" ? () => setVue("menu") : fermer} hitSlop={10}>
            <Text style={styles.fermer}>{vue === "objectif" ? "Retour" : "Fermer"}</Text>
          </Pressable>
        </View>

        {vue === "objectif" ? (
          <FormulaireObjectif
            profilInitial={etat.profil}
            titre="Modifier l'objectif"
            sousTitre="Ajustez votre profil ; l'objectif est recalculé."
            libelleValider="Enregistrer"
            onValider={(profil, objectif) => {
              onModifierObjectif(profil, objectif);
              setVue("menu");
            }}
          />
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" {...defil}>
            {/* Objectif actuel */}
            <View style={styles.carte} ref={cible("params-objectif")}>
              <Text style={styles.champLabel}>Objectif quotidien</Text>
              <Text style={styles.objectifGros}>{etat.objectif} kcal</Text>
              <TouchableOpacity
                style={[styles.bouton, { marginTop: 12, backgroundColor: accent }]}
                onPress={() => setVue("objectif")}
              >
                <Text style={styles.boutonTexte}>Modifier mon objectif</Text>
              </TouchableOpacity>
            </View>

            {/* Saisie du poids */}
            <View style={styles.carte} ref={cible("params-poids")}>
              <Text style={styles.champLabel}>Mon poids</Text>
              {dernierPoids ? (
                <Text style={styles.objectifDetail}>
                  Dernier : {dernierPoids.valeur} kg ({dernierPoids.date})
                </Text>
              ) : (
                <Text style={styles.objectifDetail}>Aucun poids enregistré.</Text>
              )}
              <View style={[styles.champNombreBoite, { marginTop: 10 }]}>
                <TextInput
                  style={styles.champNombreSaisie}
                  value={poidsSaisi}
                  onChangeText={(t) => setPoidsSaisi(t.replace(/[^0-9.,]/g, ""))}
                  keyboardType="numeric"
                  placeholder="Poids du jour"
                  placeholderTextColor={COULEURS.doux}
                  maxLength={5}
                />
                <Text style={styles.champNombreUnite}>kg</Text>
              </View>
              <TouchableOpacity
                style={[styles.bouton, styles.boutonSecondaire, { marginTop: 10 }]}
                onPress={validerPoids}
              >
                <Text style={styles.boutonTexte}>Enregistrer mon poids</Text>
              </TouchableOpacity>
            </View>

            {/* Remise a zero du jour */}
            <View style={styles.carte} ref={cible("params-journee")}>
              <Text style={styles.champLabel}>Journée en cours</Text>
              <TouchableOpacity
                style={[styles.bouton, styles.boutonSecondaire]}
                onPress={onResetJour}
              >
                <Text style={styles.boutonTexte}>Remettre le jour à zéro</Text>
              </TouchableOpacity>
            </View>

            {/* Tutoriel */}
            <View style={styles.carte} ref={cible("params-tuto")}>
              <Text style={styles.champLabel}>Tutoriel</Text>
              <TouchableOpacity
                style={[styles.bouton, styles.boutonSecondaire]}
                onPress={() => { setVue("menu"); onRevoirTuto(); }}
              >
                <Text style={styles.boutonTexte}>Revoir le tutoriel</Text>
              </TouchableOpacity>
            </View>

            {/* Section de TEST — visible en mode developpement (Expo Go) et
                dans les versions de test publiees par le workflow expo-go.yml
                (TEST), jamais dans un vrai build de production. Permet de voir
                la progression evoluer sans attendre l'XP reelle. */}
            {TEST || (typeof __DEV__ !== "undefined" && __DEV__) ? (
              <View style={[styles.carte, { borderWidth: 1, borderColor: COULEURS.accent }]}>
                <Text style={styles.champLabel}>🧪 Test (mode développeur)</Text>
                <Text style={styles.objectifDetail}>
                  Niveau {niveauDepuisXp(etat.jeu.xp).niveau} · {etat.jeu.xp} XP ·
                  étape {etapePersonnage(niveauDepuisXp(etat.jeu.xp).niveau) + 1}/{NB_ETAPES}
                </Text>
                <View style={[styles.row2, { marginTop: 10 }]}>
                  <TouchableOpacity style={[styles.bouton, styles.boutonSecondaire, styles.boutonMoitie]} onPress={() => onDevXp(100)}>
                    <Text style={styles.boutonTexte}>+100 XP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.bouton, styles.boutonSecondaire, styles.boutonMoitie]} onPress={() => onDevXp(1000)}>
                    <Text style={styles.boutonTexte}>+1000 XP</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.bouton, styles.boutonSecondaire, { marginTop: 8 }]} onPress={onResetHeros}>
                  <Text style={styles.boutonTexte}>Réinitialiser le héros</Text>
                </TouchableOpacity>
                {/* En vrai le choix est definitif ; ce bouton sert seulement a
                    voir les deux persos pendant le developpement. */}
                <TouchableOpacity style={[styles.bouton, styles.boutonSecondaire]} onPress={onDevPerso}>
                  <Text style={styles.boutonTexte}>Changer de perso (test)</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* IA vision : choix (Gemini / Claude) et cle */}
            <View ref={cible("params-cle")}>
              <CarteIA />
            </View>

            {/* Apple Sante */}
            <View style={styles.carte} ref={cible("params-sante")}>
              <Text style={styles.champLabel}>Apple Santé</Text>
              {dispoSante ? (
                <TouchableOpacity
                  style={[styles.bouton, styles.boutonSecondaire]}
                  onPress={reconnecterSante}
                >
                  <Text style={styles.boutonTexte}>Reconnecter Apple Santé</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.disclaimer}>
                  Disponible seulement dans un build de développement (voir README).
                </Text>
              )}
              {messageSante ? <Text style={styles.objectifDetail}>{messageSante}</Text> : null}
            </View>

            <Text style={[styles.astuceCentre, { marginBottom: 20 }]}>Version {VERSION}</Text>
          </ScrollView>
        )}

        {/* Etapes du tutoriel qui portent sur les Parametres. */}
        {tuto}
      </View>
    </Modal>
  );
}

// =========================================================================
//  ECRAN BILAN — calories restantes du jour (objectif + sport - consomme)
// =========================================================================

function EcranBilan({ objectif, consomme, sport, onSport }) {
  const cible = useCible();
  const defil = useDefilTuto("bilan");
  // Le "sport du jour" (saisi a la main, ou importe depuis Apple Sante) vit dans
  // l'etat global : sinon il serait efface a chaque changement d'onglet.
  const [dispoSante] = useState(() => santeDisponible());
  const [etatSante, setEtatSante] = useState("depart"); // depart | chargement | erreur
  const [erreurSante, setErreurSante] = useState(null);

  async function importerSante() {
    setEtatSante("chargement");
    setErreurSante(null);
    try {
      await demanderAcces();
      const d = await depenseDuJour();
      // On ajoute l'energie ACTIVE (le sport), pas le metabolisme de repos :
      // le repos est deja couvert par l'objectif de base.
      if (d.active != null) onSport(String(d.active));
      setEtatSante("depart");
    } catch (e) {
      setErreurSante(e.message);
      setEtatSante("depart");
    }
  }

  const bilan = bilanJournalier({
    objectif,
    sport: parseInt(sport || "0", 10),
    consomme,
  });

  return (
    <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled" {...defil}>
      <Text style={styles.titre}>Bilan du jour</Text>

      {(
        <>
          <View style={styles.carte} ref={cible("bilan-reste")}>
            <Text style={styles.champLabel}>Il vous reste</Text>
            <Text
              style={[
                styles.objectifGros,
                bilan.restant < 0 && { color: COULEURS.rouge },
              ]}
            >
              {bilan.restant} kcal
            </Text>
            <Text style={styles.objectifSous}>
              {bilan.restant < 0
                ? `Objectif dépassé de ${bilan.depassement} kcal`
                : `sur un budget de ${bilan.budget} kcal`}
            </Text>

            {/* Barre de progression du consomme sur le budget */}
            <View style={styles.barreFond}>
              <View
                style={[
                  styles.barreRemplie,
                  { width: `${Math.round(bilan.part * 100)}%` },
                  bilan.restant < 0 && { backgroundColor: COULEURS.rouge },
                ]}
              />
            </View>

            <View style={styles.gridBesoins}>
              <View style={styles.besoinCase}>
                <Text style={styles.besoinValeur}>{objectif}</Text>
                <Text style={styles.besoinLabel}>objectif{"\n"}de base</Text>
              </View>
              <View style={styles.besoinCase}>
                <Text style={[styles.besoinValeur, { color: COULEURS.vert }]}>
                  +{parseInt(sport || "0", 10)}
                </Text>
                <Text style={styles.besoinLabel}>sport{"\n"}du jour</Text>
              </View>
              <View style={styles.besoinCase}>
                <Text style={[styles.besoinValeur, { color: COULEURS.accent }]}>
                  −{consomme}
                </Text>
                <Text style={styles.besoinLabel}>consommé{"\n"}aujourd'hui</Text>
              </View>
            </View>

            {bilan.avertissements.map((a, i) => (
              <View key={i} style={styles.avertissement}>
                <Text style={styles.avertissementTexte}>⚠️ {a}</Text>
              </View>
            ))}
          </View>

          <View style={styles.carte} ref={cible("bilan-sport")}>
            <Text style={styles.champLabel}>Sport du jour</Text>
            <View style={styles.champNombreBoite}>
              <TextInput
                style={styles.champNombreSaisie}
                value={sport}
                onChangeText={(t) => onSport(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={COULEURS.doux}
                maxLength={4}
              />
              <Text style={styles.champNombreUnite}>kcal brûlées</Text>
            </View>

            {dispoSante ? (
              <>
                <TouchableOpacity
                  style={[styles.bouton, styles.boutonSecondaire, { marginTop: 12 }]}
                  onPress={importerSante}
                  disabled={etatSante === "chargement"}
                >
                  <Text style={styles.boutonTexte}>
                    {etatSante === "chargement" ? "Lecture…" : "Importer depuis Apple Santé"}
                  </Text>
                </TouchableOpacity>
                {erreurSante ? <Text style={styles.erreurLigne}>{erreurSante}</Text> : null}
              </>
            ) : (
              <Text style={styles.disclaimer}>
                L'import automatique depuis Apple Santé nécessite un build de
                développement (voir README). En attendant, saisissez les calories
                de votre séance à la main.
              </Text>
            )}
          </View>

          <View style={styles.carte} ref={cible("bilan-consomme")}>
            <Text style={styles.champLabel}>Consommé aujourd'hui</Text>
            <Text style={styles.objectifDetail}>{consomme} kcal</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

/** Carte de resultat : besoin, objectif, macros, avertissements de securite. */
function ResultatObjectif({ r }) {
  const signe = r.ecartReel > 0 ? "+" : "";
  const libelleBut =
    r.but === "perte" ? "perte de poids" : r.but === "prise" ? "prise de muscle" : "maintien";

  return (
    <View style={styles.carte}>
      <Text style={styles.champLabel}>Objectif quotidien</Text>
      <Text style={styles.objectifGros}>{r.objectif} kcal</Text>
      <Text style={styles.objectifSous}>pour un objectif de {libelleBut}</Text>

      {r.but !== "maintien" && !r.deficitImpossible && (
        <Text style={styles.objectifDetail}>
          {signe}
          {r.ecartReel} kcal/j par rapport au maintien · rythme ≈ {r.rythmeHebdoKg} kg/sem
        </Text>
      )}

      <View style={styles.gridBesoins}>
        <View style={styles.besoinCase}>
          <Text style={styles.besoinValeur}>{r.bmr}</Text>
          <Text style={styles.besoinLabel}>métabolisme{"\n"}de base</Text>
        </View>
        <View style={styles.besoinCase}>
          <Text style={styles.besoinValeur}>{r.tdee}</Text>
          <Text style={styles.besoinLabel}>maintien{"\n"}au repos</Text>
        </View>
        <View style={styles.besoinCase}>
          <Text style={[styles.besoinValeur, { color: COULEURS.accent }]}>{r.objectif}</Text>
          <Text style={styles.besoinLabel}>objectif{"\n"}visé</Text>
        </View>
      </View>

      <Text style={styles.champLabel}>Répartition indicative</Text>
      <View style={styles.gridMacros}>
        <MacroCase valeur={r.macros.proteines} label="Protéines" />
        <MacroCase valeur={r.macros.glucides} label="Glucides" />
        <MacroCase valeur={r.macros.lipides} label="Lipides" />
      </View>

      {r.avertissements.map((a, i) => (
        <View key={i} style={styles.avertissement}>
          <Text style={styles.avertissementTexte}>⚠️ {a}</Text>
        </View>
      ))}

      <Text style={styles.disclaimer}>
        Estimation indicative (formule de Mifflin-St Jeor). Ce n'est pas un avis
        médical. En cas de grossesse, d'allaitement, de pathologie ou de trouble
        du comportement alimentaire, consultez un professionnel de santé avant
        de modifier votre alimentation.
      </Text>
    </View>
  );
}

function MacroCase({ valeur, label }) {
  return (
    <View style={styles.macroCase}>
      <Text style={styles.macroValeur}>{valeur} g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

/** Controle segmente generique. `colonne` empile verticalement (libelles longs). */
function Segment({ options, valeur, onChange, colonne }) {
  return (
    <View style={[styles.segment, colonne && styles.segmentColonne]}>
      {options.map(([cle, libelle]) => (
        <Pressable
          key={cle}
          style={[
            styles.segmentBtn,
            colonne && styles.segmentBtnColonne,
            valeur === cle && styles.segmentBtnActif,
          ]}
          onPress={() => onChange(cle)}
        >
          <Text style={[styles.segmentTexte, valeur === cle && styles.segmentTexteActif]}>
            {libelle}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Champ numerique labellise, pour age / poids / taille. */
function ChampNombre({ label, valeur, onChange, unite }) {
  return (
    <View style={styles.champNombre}>
      <Text style={styles.champLabel}>{label}</Text>
      <View style={styles.champNombreBoite}>
        <TextInput
          style={styles.champNombreSaisie}
          value={valeur}
          onChangeText={(t) => onChange(t.replace(/[^0-9.,]/g, ""))}
          keyboardType="numeric"
          placeholder="—"
          placeholderTextColor={COULEURS.doux}
          maxLength={5}
        />
        <Text style={styles.champNombreUnite}>{unite}</Text>
      </View>
    </View>
  );
}

// =========================================================================
//  ECRAN PROGRESSION — courbe de poids + historique des calories
// =========================================================================

// =========================================================================
//  ECRAN JOURNAL — calendrier facon Apple (Annee / Mois / Semaine / Jour) de
//  tous les jours depuis le premier lancement (donnees : journal.js). On
//  change de niveau en pincant (ecarter = zoom avant), avec le selecteur, ou
//  en touchant un mois / un jour.
// =========================================================================

const VERDICTS = {
  cible: { libelle: "🎯 Dans la cible", couleur: () => COULEURS.vert },
  dessus: { libelle: "Au-dessus", couleur: () => COULEURS.rouge },
  dessous: { libelle: "Trop peu mangé", couleur: () => COULEURS.doux },
};
const LIBELLES_NIVEAUX = { jour: "Jour", semaine: "Semaine", mois: "Mois", annee: "Année" };
const HEURE_DEBUT = 6;     // debut de la frise horaire (vue Semaine / Jour)
const HAUTEUR_HEURE = 34;  // px par heure dans la frise
const ANIM_NATIVE_CAL = Platform.OS !== "web";

// Cle de la periode d'une date, pour savoir si deux dates tombent dans la
// meme annee / le meme mois / la meme semaine / le meme jour.
const clePeriode = (niveau, s) =>
  niveau === "annee" ? s.slice(0, 4) : niveau === "mois" ? s.slice(0, 7) : niveau === "semaine" ? lundiDe(s) : s;

/** Couleur d'un jour dans le calendrier (null : rien a signaler). */
function couleurJour(e) {
  if (!e) return null;
  if (e.type === "suivi") return VERDICTS[e.verdict].couleur();
  if (e.type === "aujourdhui" && e.consomme > 0) return COULEURS.accent;
  return null;
}

/** Position verticale d'un repas « HH:MM » dans la frise horaire. */
function hautRepas(heure) {
  const [h, m] = String(heure || "12:00").split(":").map(Number);
  return Math.max(0, (h - HEURE_DEBUT + (m || 0) / 60) * HAUTEUR_HEURE);
}

function EcranJournal({ etat }) {
  const cible = useCible();
  const accent = useAccent();
  const aujourdhui = dateDuJour();
  const [niveau, setNiveau] = useState("mois");
  const [focus, setFocus] = useState(aujourdhui); // date au centre de la vue
  const [defilement, setDefilement] = useState(true);
  const jours = useMemo(() => joursDuJournal(etat, aujourdhui), [etat, aujourdhui]);
  const parDate = useMemo(() => new Map(jours.map((j) => [j.date, j])), [jours]);
  const resume = resumeJournal(jours);
  const debut = resume.debut || aujourdhui;

  // --- Changement de niveau, anime (zoom avant : la vue grossit en arrivant) ---
  const anim = useRef(new Animated.Value(1)).current;
  const sensRef = useRef(1);
  const changerNiveau = (n, date) => {
    if (date) setFocus(date);
    if (n === niveau) return;
    sensRef.current = NIVEAUX_CALENDRIER.indexOf(n) > NIVEAUX_CALENDRIER.indexOf(niveau) ? 1 : -1;
    setNiveau(n);
  };
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: ANIM_NATIVE_CAL }).start();
  }, [niveau]);

  // --- Pincer : deux doigts qui s'ecartent = zoom avant, qui se rapprochent =
  // zoom arriere. Un seul cran par geste. Un doigt seul reste au defilement.
  const niveauRef = useRef(niveau);
  niveauRef.current = niveau;
  const zoomerRef = useRef(null);
  zoomerRef.current = (sens) => {
    const n = niveauVoisin(niveauRef.current, sens);
    if (n !== niveauRef.current) changerNiveau(n);
  };
  const pince = useRef({ d0: null, fait: false }).current;
  const ecart = (t) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
  const deuxDoigts = (e) => (e.nativeEvent.touches || []).length >= 2;
  const panPince = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: deuxDoigts,
      onMoveShouldSetPanResponderCapture: deuxDoigts,
      onPanResponderGrant: () => {
        pince.d0 = null;
        pince.fait = false;
        setDefilement(false);
      },
      // Un doigt de plus pose : on repart d'un nouveau pincement.
      onPanResponderStart: () => {
        pince.d0 = null;
        pince.fait = false;
      },
      onPanResponderMove: (e) => {
        const t = e.nativeEvent.touches || [];
        // Moins de deux doigts : le pincement est fini (meme si la fin du geste
        // n'a pas ete signalee), le prochain repartira de zero.
        if (t.length < 2) { pince.d0 = null; pince.fait = false; return; }
        if (pince.fait) return;
        const d = ecart(t);
        if (pince.d0 == null) { pince.d0 = d; return; }
        const r = d / pince.d0;
        if (r > 1.25) { pince.fait = true; zoomerRef.current(1); }
        else if (r < 0.8) { pince.fait = true; zoomerRef.current(-1); }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderEnd: () => { pince.d0 = null; pince.fait = false; },
      onPanResponderRelease: () => setDefilement(true),
      onPanResponderTerminate: () => setDefilement(true),
    })
  ).current;

  // --- Navigation ‹ › entre periodes, bornee au journal (debut -> aujourd'hui) ---
  const periodeVoisine = (sens) => {
    let d = decalerPeriode(niveau, focus, sens);
    if (sens > 0 && d > aujourdhui) {
      if (clePeriode(niveau, d) !== clePeriode(niveau, aujourdhui)) return null;
      d = aujourdhui;
    }
    if (sens < 0 && clePeriode(niveau, d) < clePeriode(niveau, debut)) return null;
    return d;
  };
  const precedente = periodeVoisine(-1);
  const suivante = periodeVoisine(1);

  const echelle = anim.interpolate({ inputRange: [0, 1], outputRange: [sensRef.current > 0 ? 0.9 : 1.1, 1] });

  return (
    <View style={{ flex: 1 }} {...panPince.panHandlers}>
      <ScrollView contentContainerStyle={styles.contenu} scrollEnabled={defilement}>
        <Text style={styles.titre}>Journal</Text>
        <Text style={styles.sousTitre}>
          {resume.total} jour{resume.total > 1 ? "s" : ""} depuis le début · {resume.suivis} suivi
          {resume.suivis > 1 ? "s" : ""} · {resume.dansLaCible} dans la cible
        </Text>

        <View ref={cible("journal-calendrier")} style={styles.calBloc}>
          {/* Periode + navigation */}
          <View style={styles.calEntete}>
            <Pressable onPress={() => precedente && setFocus(precedente)} hitSlop={12} disabled={!precedente}>
              <Text style={[styles.calFleche, !precedente && styles.calFlecheInactive]}>‹</Text>
            </Pressable>
            <Text style={styles.calTitre}>{titrePeriode(niveau, focus)}</Text>
            <Pressable onPress={() => suivante && setFocus(suivante)} hitSlop={12} disabled={!suivante}>
              <Text style={[styles.calFleche, !suivante && styles.calFlecheInactive]}>›</Text>
            </Pressable>
          </View>

          {/* Selecteur de niveau */}
          <View style={styles.calSegments}>
            {[...NIVEAUX_CALENDRIER].reverse().map((n) => (
              <Pressable
                key={n}
                onPress={() => changerNiveau(n)}
                style={[styles.calSegment, niveau === n && { backgroundColor: accent }]}
              >
                <Text style={[styles.calSegmentTexte, niveau === n && { color: COULEURS.surAccent }]}>
                  {LIBELLES_NIVEAUX[n]}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.calAide}>
            {focus !== aujourdhui || niveau !== "jour" ? (
              <Pressable onPress={() => setFocus(aujourdhui)} hitSlop={8}>
                <Text style={[styles.astuceCentre, { color: COULEURS.accent, fontWeight: "700" }]}>Aujourd'hui</Text>
              </Pressable>
            ) : null}
          </View>

          <Animated.View style={{ opacity: anim, transform: [{ scale: echelle }] }}>
            {niveau === "annee" ? (
              <VueAnnee focus={focus} parDate={parDate} aujourdhui={aujourdhui}
                onMois={(d) => changerNiveau("mois", d > aujourdhui ? aujourdhui : d)} />
            ) : niveau === "mois" ? (
              <VueMois focus={focus} parDate={parDate} aujourdhui={aujourdhui}
                onJour={(d) => changerNiveau("jour", d)} />
            ) : niveau === "semaine" ? (
              <VueSemaine focus={focus} parDate={parDate} aujourdhui={aujourdhui} accent={accent}
                onJour={(d) => changerNiveau("jour", d)} />
            ) : (
              <VueJour date={focus} e={parDate.get(focus)} accent={accent} />
            )}
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

/** Vue Annee : 12 mini-mois ; touchez un mois pour l'ouvrir. */
function VueAnnee({ focus, parDate, aujourdhui, onMois }) {
  const annee = Number(focus.slice(0, 4));
  return (
    <View style={styles.calAnnee}>
      {Array.from({ length: 12 }, (_, m) => {
        const courant = aujourdhui.slice(0, 7) === `${annee}-${String(m + 1).padStart(2, "0")}`;
        return (
          <Pressable key={m} style={styles.calMiniMois} onPress={() => onMois(`${annee}-${String(m + 1).padStart(2, "0")}-01`)}>
            <Text style={[styles.calMiniTitre, courant && { color: COULEURS.accent }]}>{nomMois(m)}</Text>
            {grilleMois(annee, m).map((sem, i) => (
              <View key={i} style={styles.calLigne}>
                {sem.map((d, k) => {
                  const c = d ? couleurJour(parDate.get(d)) : null;
                  return (
                    <View key={k} style={[styles.calMiniCase, c && { backgroundColor: c }, d === aujourdhui && styles.calMiniAujourdhui]}>
                      <Text style={[styles.calMiniNum, c && { color: "#fff" }]}>{d ? Number(d.slice(8)) : ""}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Vue Mois : grille lundi -> dimanche, pastille et kcal de chaque jour. */
function VueMois({ focus, parDate, aujourdhui, onJour }) {
  const [a, m] = focus.split("-").map(Number);
  return (
    <View>
      <View style={styles.calLigne}>
        {JOURS_COURTS.map((j, i) => (
          <Text key={i} style={styles.calJourSemaine}>{j}</Text>
        ))}
      </View>
      {grilleMois(a, m - 1).map((sem, i) => (
        <View key={i} style={styles.calLigne}>
          {sem.map((d, k) => {
            if (!d) return <View key={k} style={styles.calCase} />;
            const e = parDate.get(d);
            const c = couleurJour(e);
            const auj = d === aujourdhui;
            return (
              <Pressable key={k} style={[styles.calCase, d > aujourdhui && { opacity: 0.35 }]} onPress={() => onJour(d)} disabled={d > aujourdhui}>
                <View style={[styles.calNumBoite, auj && { backgroundColor: COULEURS.accent }]}>
                  <Text style={[styles.calNum, auj && { color: "#fff" }]}>{Number(d.slice(8))}</Text>
                </View>
                {c ? <View style={[styles.calPastille, { backgroundColor: c }]} /> : null}
                {e && e.consomme > 0 ? <Text style={styles.calKcal}>{e.consomme}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={styles.calLegende}>
        <Text style={[styles.calLegendeTexte, { color: COULEURS.vert }]}>● dans la cible</Text>
        <Text style={[styles.calLegendeTexte, { color: COULEURS.rouge }]}>● au-dessus</Text>
        <Text style={[styles.calLegendeTexte, { color: COULEURS.doux }]}>● trop peu</Text>
      </View>
    </View>
  );
}

/** Vue Semaine : 7 colonnes, les repas places a leur heure sur une frise. */
function VueSemaine({ focus, parDate, aujourdhui, accent, onJour }) {
  const dates = semaineDe(focus);
  const heures = Array.from({ length: 24 - HEURE_DEBUT }, (_, i) => HEURE_DEBUT + i);
  return (
    <View>
      <View style={styles.calLigne}>
        <View style={styles.calGouttiere} />
        {dates.map((d, i) => {
          const e = parDate.get(d);
          const c = couleurJour(e);
          const auj = d === aujourdhui;
          return (
            <Pressable key={d} style={styles.calColEntete} onPress={() => onJour(d)} disabled={d > aujourdhui}>
              <Text style={styles.calJourSemaine}>{JOURS_COURTS[i]}</Text>
              <View style={[styles.calNumBoite, auj && { backgroundColor: COULEURS.accent }]}>
                <Text style={[styles.calNum, auj && { color: "#fff" }, d > aujourdhui && { opacity: 0.35 }]}>{Number(d.slice(8))}</Text>
              </View>
              <Text style={[styles.calKcal, c && { color: c, fontWeight: "700" }]}>{e && e.consomme > 0 ? e.consomme : " "}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.calLigne, { height: heures.length * HAUTEUR_HEURE }]}>
        <View style={styles.calGouttiere}>
          {heures.map((h) => (
            <Text key={h} style={[styles.calHeure, { top: (h - HEURE_DEBUT) * HAUTEUR_HEURE - 6 }]}>{h}h</Text>
          ))}
        </View>
        {dates.map((d) => (
          <Pressable key={d} style={styles.calColonne} onPress={() => onJour(d)} disabled={d > aujourdhui}>
            {heures.map((h) => (
              <View key={h} style={[styles.calTrait, { top: (h - HEURE_DEBUT) * HAUTEUR_HEURE }]} />
            ))}
            {(parDate.get(d)?.repas || []).map((r, i) => (
              <View key={i} style={[styles.calBlocRepas, { top: hautRepas(r.heure), backgroundColor: accent }]}>
                <Text style={[styles.calBlocTexte, { color: COULEURS.surAccent }]} numberOfLines={1}>{r.kcal}</Text>
              </View>
            ))}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Vue Jour : le bilan de la journee et ses repas sur une frise horaire. */
function VueJour({ date, e, accent }) {
  if (!e || e.type === "vide") {
    return (
      <View style={styles.journalJour}>
        <Text style={styles.journalDetail}>
          {e?.poids != null ? `Pas de repas enregistré · ⚖️ ${e.poids} kg` : e ? "Pas de suivi ce jour-là." : "Hors de la période du journal."}
        </Text>
      </View>
    );
  }
  const v = e.verdict ? VERDICTS[e.verdict] : null;
  const part = e.budget > 0 ? Math.min(1, e.consomme / e.budget) : 0;
  const repas = [...e.repas].sort((a, b) => String(a.heure).localeCompare(String(b.heure)));
  return (
    <View>
      <View style={styles.journalJour}>
        <View style={styles.journalLigneHaut}>
          <Text style={styles.journalKcal}>
            {e.consomme} <Text style={styles.journalDetail}>/ {e.budget} kcal</Text>
          </Text>
          <Text style={[styles.journalVerdict, { color: v ? v.couleur() : COULEURS.doux }]}>{v ? v.libelle : "En cours"}</Text>
        </View>
        <View style={styles.journalBarreFond}>
          <View style={[styles.journalBarre, { width: `${Math.round(part * 100)}%` }, e.verdict === "dessus" && { backgroundColor: COULEURS.rouge }]} />
        </View>
        <Text style={styles.journalDetail}>
          objectif {e.objectif}
          {e.sport ? ` · sport +${e.sport}` : ""}
          {e.poids != null ? ` · ⚖️ ${e.poids} kg` : ""}
        </Text>
      </View>

      <Text style={[styles.champLabel, { marginTop: 18 }]}>Repas</Text>
      {repas.length ? (
        repas.map((r, i) => (
          <View key={i} style={styles.calRepasLigne}>
            <Text style={styles.calRepasHeure}>{r.heure}</Text>
            <View style={[styles.calRepasBloc, { borderLeftColor: accent }]}>
              <Text style={styles.journalRepasLigne}>{r.plat}</Text>
              <Text style={styles.journalDetail}>{r.kcal} kcal</Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.journalDetail}>
          {e.consomme > 0 ? "Détail des repas non disponible pour ce jour." : "Aucun repas ajouté pour l'instant."}
        </Text>
      )}
    </View>
  );
}

function EcranProgression({ etat }) {
  const poids = etat.poids || [];
  const historique = etat.historique || [];

  // But (perte/prise/maintien) pour orienter la lecture de la courbe de poids.
  const but = etat.profil?.but;

  // Geste commence sur le perso : le defilement natif est coupe (sinon il vole
  // le geste au moindre ecart vertical). AvatarPerso tranche ensuite : geste
  // quasi horizontal -> il tourne le perso ; geste vertical -> on fait defiler
  // la page nous-memes, du deplacement du doigt.
  const [defilement, setDefilement] = useState(true);
  const cible = useCible();
  const defil = useDefilTuto("progression"); // le tutoriel fait defiler la page
  const scrollRef = useRef(null);
  const yRef = useRef(0);       // position de defilement courante
  const departRef = useRef(0);  // position au debut du geste
  const maxRef = useRef(0);     // defilement maximal (contenu - fenetre)
  const hauteurs = useRef({ contenu: 0, fenetre: 0 });
  const majMax = () => {
    maxRef.current = Math.max(0, hauteurs.current.contenu - hauteurs.current.fenetre);
  };
  const onGestePerso = (type, dy) => {
    if (type === "debut") {
      departRef.current = yRef.current;
      setDefilement(false);
    } else if (type === "vertical") {
      const y = Math.max(0, Math.min(maxRef.current, departRef.current - dy));
      scrollRef.current?.scrollTo({ y, animated: false });
    } else {
      setDefilement(true);
    }
  };

  return (
    <ScrollView
      ref={(n) => { scrollRef.current = n; defil.ref(n); }}
      contentContainerStyle={styles.contenu}
      scrollEnabled={defilement}
      scrollEventThrottle={16}
      onScroll={(e) => { yRef.current = e.nativeEvent.contentOffset.y; defil.onScroll(e); }}
      onLayout={(e) => { hauteurs.current.fenetre = e.nativeEvent.layout.height; majMax(); }}
      onContentSizeChange={(_w, h) => { hauteurs.current.contenu = h; majMax(); }}
    >
      <Text style={styles.titre}>Progression</Text>
      <Text style={styles.sousTitre}>Votre poids et vos calories dans le temps</Text>

      {/* --- Personnage & niveau --- */}
      <CarteHeros jeu={etat.jeu} perso={etat.perso} onGeste={onGestePerso} />

      {/* --- Courbe de poids --- */}
      <View style={styles.carte} ref={cible("prog-poids")}>
        <Text style={styles.champLabel}>Poids</Text>
        {poids.length < 2 ? (
          <Text style={styles.objectifDetail}>
            {poids.length === 0
              ? "Aucun poids enregistré."
              : `Un seul point (${poids[0].valeur} kg).`}
          </Text>
        ) : (
          <CourbePoids poids={poids} but={but} />
        )}
      </View>

      {/* --- Historique des calories --- */}
      <View style={styles.carte} ref={cible("prog-calories")}>
        <Text style={styles.champLabel}>Calories des derniers jours</Text>
        {historique.length === 0 ? (
          <Text style={styles.objectifDetail}>
            Aucun jour terminé pour l'instant.
          </Text>
        ) : (
          <BarresCalories historique={historique} />
        )}
      </View>
    </ScrollView>
  );
}

// Rotation du perso : le geste doit rester a moins de 30 degres de
// l'horizontale. Au-dela, c'est un defilement de la page.
const ANGLE_ROTATION_MAX = 30;
const TAN_ROTATION_MAX = Math.tan((ANGLE_ROTATION_MAX * Math.PI) / 180);
const SEUIL_DECISION = 10; // px parcourus avant de trancher

/**
 * Le personnage, que l'utilisateur fait tourner en glissant le doigt a
 * l'horizontale : chaque tranche de deplacement passe a la direction suivante
 * (8 en tout, ca boucle). Les sprites sont prepares par tools/build-perso.js :
 * meme canevas pour toutes les etapes (le perso ne saute pas d'une etape a
 * l'autre) et pixels deja agrandis (pas de flou).
 */
function AvatarPerso({ perso, etape, taille = 280, zoom = 1, tournable = true, onGeste }) {
  const idx = Math.max(0, Math.min(etape, NB_ETAPES - 1));
  const frames = SPRITES[perso][idx];
  const [direction, setDirection] = useState(0);
  // Animation d'attente, de face seulement (les 7 autres directions restent
  // des images fixes). Tant que le GIF « idle » de l'etape manque, le perso
  // respire en code : il monte et descend d'un pixel de l'art.
  const idle = direction === 0 ? ANIMS[perso]?.[idx]?.idle : null;
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    setFrame(0);
    const t = setInterval(() => setFrame((f) => f + 1), idle ? idle.ms : 700);
    return () => clearInterval(t);
  }, [idle]);
  const directionRef = useRef(0); // valeur courante, lisible dans le geste
  const baseRef = useRef(0);      // direction au debut du glissement
  const modeRef = useRef(null);   // null (pas encore tranche) | "rotation" | "vertical"
  // onGeste("debut" | "vertical" | "fin", dy) : tient le parent au courant,
  // pour qu'il coupe son defilement natif et fasse defiler la page lui-meme
  // si le geste est vertical. Lu via une ref : le PanResponder est cree une
  // seule fois.
  const onGesteRef = useRef(onGeste);
  onGesteRef.current = onGeste;
  const fin = () => onGesteRef.current?.("fin");

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3,
      onPanResponderGrant: () => {
        baseRef.current = directionRef.current;
        modeRef.current = null;
        onGesteRef.current?.("debut");
      },
      onPanResponderMove: (_e, g) => {
        if (modeRef.current === null) {
          // On attend un petit deplacement pour juger de la direction.
          if (Math.hypot(g.dx, g.dy) < SEUIL_DECISION) return;
          modeRef.current =
            Math.abs(g.dy) <= Math.abs(g.dx) * TAN_ROTATION_MAX ? "rotation" : "vertical";
        }
        if (modeRef.current === "vertical") {
          onGesteRef.current?.("vertical", g.dy);
          return;
        }
        // ~22 px de glissement = une direction. Glisser vers la droite fait
        // tourner le perso vers la droite (sens naturel du geste).
        const n = (((baseRef.current + Math.round(g.dx / 22)) % 8) + 8) % 8;
        directionRef.current = n;
        setDirection(n);
      },
      // Le geste reste au perso jusqu'au lever du doigt.
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: fin,
      onPanResponderTerminate: fin,
    })
  ).current;

  const cote = taille * zoom; // cote affiche d'une image 128 x 128 de l'art
  return (
    // zoom > 1 recadre sur le centre du canevas : utile pour les premieres
    // etapes, ou le perso n'occupe que le milieu (la marge sert aux effets des
    // etapes suivantes).
    <View
      style={{ width: taille, height: taille, overflow: "hidden", alignItems: "center", justifyContent: "center" }}
      {...(tournable ? pan.panHandlers : {})}
    >
      {idle ? (
        <View style={{ width: cote, height: cote, overflow: "hidden" }}>
          <Image
            source={idle.planche}
            fadeDuration={0}
            style={{
              position: "absolute",
              width: cote * idle.colonnes,
              height: cote * Math.ceil(idle.n / idle.colonnes),
              left: -((frame % idle.n) % idle.colonnes) * cote,
              top: -Math.floor((frame % idle.n) / idle.colonnes) * cote,
            }}
          />
        </View>
      ) : (
        <Image
          source={frames[direction]}
          style={{ width: cote, height: cote, transform: [{ translateY: frame % 2 ? -cote / 128 : 0 }] }}
          fadeDuration={0}
        />
      )}
    </View>
  );
}

/** Premier lancement : choix du personnage, definitif. */
function ChoixPerso({ onChoisir }) {
  const [choix, setChoix] = useState(null);
  const accent = useAccent();

  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <Text style={styles.titre}>Votre héros</Text>
      <Text style={styles.sousTitre}>
        Il évoluera avec vous, niveau après niveau. Choisissez bien : ce choix est définitif.
      </Text>
      <View style={styles.choixPersoRangee}>
        {["humain", "chat"].map((p) => (
          <Pressable
            key={p}
            onPress={() => setChoix(p)}
            style={[styles.choixPersoCarte, choix === p && { borderColor: accent }]}
          >
            <AvatarPerso perso={p} etape={0} taille={140} zoom={1.8} tournable={false} />
            <Text style={styles.choixPersoNom}>{PERSOS[p].nom}</Text>
          </Pressable>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.bouton, { marginTop: 24, backgroundColor: accent }, !choix && styles.boutonInactif]}
        disabled={!choix}
        onPress={() => onChoisir(choix)}
      >
        <Text style={styles.boutonTexte}>
          {choix ? `Commencer avec ${PERSOS[choix].nom.toLowerCase()}` : "Choisissez un héros"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/** Haut de Progression : le perso a meme l'ecran (niveau, XP, serie), puis la carte des badges. */
function CarteHeros({ jeu, perso, onGeste }) {
  const cible = useCible();
  // Perso en grand : 320 px, sans deborder sur les petits ecrans (marges 20).
  const { width: largeurEcran } = useWindowDimensions();
  const taillePerso = Math.min(320, largeurEcran - 40);
  const j = jeu || { xp: 0, streak: 0, badges: [] };
  const niv = niveauDepuisXp(j.xp);
  const theme = themePerso(perso, niv.niveau); // couleurs du theme (perso, niveau)
  const badgesAcquis = new Set(j.badges || []);
  const etape = etapePersonnage(niv.niveau);

  return (
    <>
      {/* Le perso, a meme l'ecran (pas de carte) : centre, avec niveau et
          barre d'XP centres juste en dessous. */}
      <View style={styles.herosZone}>
        {perso ? (
          <>
            <View ref={cible("perso")}>
              <AvatarPerso perso={perso} etape={etape} onGeste={onGeste} taille={taillePerso} />
            </View>
            <Text style={[styles.herosTitreCentre, { color: theme.accentTexte }]}>{PERSOS[perso].etapes[etape]}</Text>
          </>
        ) : null}

        <View ref={cible("xp")} style={styles.herosXpBloc}>
          <Text style={styles.herosNiveauGros}>Niveau {niv.niveau}</Text>
          <View style={[styles.xpFond, styles.xpFondCentre]}>
            <View style={[styles.xpRempli, { width: `${Math.round(niv.progression * 100)}%`, backgroundColor: theme.xp }]} />
          </View>
          <Text style={styles.herosXpCentre}>{niv.xpDansNiveau} / {niv.xpNiveau} XP</Text>
        </View>

        {j.streak > 0 ? (
          <Text style={styles.herosStreakCentre}>🔥 Série : {j.streak} jour{j.streak > 1 ? "s" : ""}</Text>
        ) : null}
      </View>

      {/* Badges */}
      <View style={styles.carte} ref={cible("badges")}>
        <Text style={styles.champLabel}>Badges</Text>
        <View style={styles.badgesZone}>
          {BADGES.map((b) => {
            const acquis = badgesAcquis.has(b.id);
            return (
              <View key={b.id} style={[styles.badge, !acquis && styles.badgeVerrou]}>
                <Text style={[styles.badgeEmoji, !acquis && styles.badgeEmojiVerrou]}>
                  {acquis ? b.emoji : "🔒"}
                </Text>
                <Text style={styles.badgeLibelle}>{b.libelle}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </>
  );
}

/** Courbe de poids en SVG (react-native-svg, inclus dans Expo Go). */
function CourbePoids({ poids, but }) {
  const L = 300; // largeur logique du dessin
  const H = 160;
  const marge = { g: 8, d: 8, h: 14, b: 18 };

  const valeurs = poids.map((p) => p.valeur);
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  const etendue = max - min || 1; // evite la division par zero si tout est egal

  const x = (i) => marge.g + (i / (poids.length - 1)) * (L - marge.g - marge.d);
  const y = (v) => marge.h + (1 - (v - min) / etendue) * (H - marge.h - marge.b);

  const points = poids.map((p, i) => `${x(i)},${y(p.valeur)}`).join(" ");
  const premier = poids[0].valeur;
  const dernier = poids[poids.length - 1].valeur;
  const delta = Math.round((dernier - premier) * 10) / 10;
  const sensAttendu = but === "perte" ? -1 : but === "prise" ? 1 : 0;
  const bonSens = sensAttendu === 0 || Math.sign(delta) === sensAttendu || delta === 0;

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${L} ${H}`}>
        {/* ligne de base (premier poids) */}
        <SvgLine x1={marge.g} y1={y(premier)} x2={L - marge.d} y2={y(premier)}
          stroke={COULEURS.bord} strokeWidth="1" strokeDasharray="4 4" />
        <Polyline points={points} fill="none" stroke={COULEURS.accent} strokeWidth="2.5" />
        {poids.map((p, i) => (
          <Circle key={i} cx={x(i)} cy={y(p.valeur)} r="3" fill={COULEURS.accent} />
        ))}
      </Svg>
      <View style={styles.legendePoids}>
        <Text style={styles.legendePoidsTexte}>
          {premier} kg → {dernier} kg
        </Text>
        <Text style={[styles.legendePoidsDelta, { color: bonSens ? COULEURS.vert : COULEURS.rouge }]}>
          {delta > 0 ? "+" : ""}{delta} kg
        </Text>
      </View>
    </View>
  );
}

/** Barres du consomme par jour, colorees selon le budget (objectif). */
function BarresCalories({ historique }) {
  const jours = historique.slice(-14); // 2 dernieres semaines
  const budgets = jours.map((j) => (j.objectif || 0) + (j.sport || 0));
  const maxRef = Math.max(...jours.map((j) => j.consomme), ...budgets, 1);

  return (
    <View style={styles.barresZone}>
      {jours.map((j, i) => {
        const budget = (j.objectif || 0) + (j.sport || 0);
        const depasse = budget > 0 && j.consomme > budget;
        const hauteur = Math.max(2, Math.round((j.consomme / maxRef) * 90));
        const jourNum = j.date.slice(8, 10); // "JJ"
        return (
          <View key={i} style={styles.barreCol}>
            <View
              style={[
                styles.barreCal,
                { height: hauteur, backgroundColor: depasse ? COULEURS.rouge : COULEURS.vert },
              ]}
            />
            <Text style={styles.barreJour}>{jourNum}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Feuille de styles, recalculee a chaque changement de palette.
function creerStyles() {
  return StyleSheet.create({
    choixSection: { color: COULEURS.accent, fontSize: 13, fontWeight: "700", textTransform: "uppercase", marginTop: 16, marginBottom: 4, marginHorizontal: 16 },
    iaLigne: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COULEURS.bord },
    iaNom: { color: COULEURS.texte, fontSize: 16, fontWeight: "600" },
    iaRetirer: { color: COULEURS.rouge, fontSize: 14, paddingLeft: 12 },
  ecran: { flex: 1, backgroundColor: COULEURS.fond },
  centreEcran: { alignItems: "center", justifyContent: "center" },
  contenu: { padding: 20, paddingTop: 16, paddingBottom: 60 },

  // Ecrans gardes montes : la page active occupe l'espace, les autres sont
  // masquees (mais conservent leur etat et leurs traitements en cours).
  page: { flex: 1 },
  pageCachee: { display: "none" },

  barreHaut: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 10, // laisse la zone de la roue au-dessus des onglets
    backgroundColor: COULEURS.fond,
    zIndex: 2, // la zone de la roue deborde un peu : elle doit passer devant les onglets
  },
  // Zone de 52 x 52 centree sur la ligne du titre (+ hitSlop) : facile a
  // toucher. zIndex : au-dessus du titre, qui occupe toute la largeur.
  rouePos: {
    position: "absolute", left: 6, top: 41, width: 52, height: 52, zIndex: 1,
    alignItems: "center", justifyContent: "center", borderRadius: 26,
  },
  roueAppui: { backgroundColor: COULEURS.appui },
  roue: { fontSize: 32, lineHeight: 36, color: COULEURS.texte },
  barreTitre: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: COULEURS.texte },

  tabs: {
    flexDirection: "row",
    paddingTop: 8,
    paddingHorizontal: 20,
    backgroundColor: COULEURS.fond,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COULEURS.piste,
  },
  tabActif: { backgroundColor: COULEURS.accent },
  tabTexte: { textAlign: "center", fontWeight: "600", color: COULEURS.doux, fontSize: 13 },
  tabTexteActif: { color: COULEURS.surAccent },

  titre: { fontSize: 32, fontWeight: "700", textAlign: "center", color: COULEURS.texte },
  sousTitre: {
    fontSize: 12,
    color: COULEURS.doux,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 22,
  },

  bouton: { backgroundColor: COULEURS.accent, padding: 16, borderRadius: 12, marginBottom: 12 },
  boutonSecondaire: { backgroundColor: COULEURS.secondaire },
  boutonScan: { backgroundColor: COULEURS.scan },
  boutonAjoutScan: {
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COULEURS.vert,
    alignItems: "center",
  },
  boutonAjoutScanTexte: { color: COULEURS.vert, fontWeight: "600" },
  supprimer: { color: COULEURS.supprimer, fontSize: 12, marginTop: 6 },
  boutonTexte: { color: COULEURS.surAccent, fontSize: 16, fontWeight: "600", textAlign: "center" },
  scanEcran: { flex: 1, backgroundColor: "#000" },
  scanCamera: { flex: 1 },
  scanBas: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 44,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  scanTexte: { color: "white", fontSize: 16, marginBottom: 16, textAlign: "center" },
  scanAnnuler: {
    backgroundColor: COULEURS.secondaire,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  scanBanniere: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  scanBanniereWarn: { backgroundColor: "rgba(176,0,32,0.92)" },
  scanBanniereOk: { backgroundColor: "rgba(74,124,89,0.92)" },
  scanBanniereTexte: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  row2: { flexDirection: "row", gap: 8 },
  boutonMoitie: { flex: 1 },

  centre: { alignItems: "center", marginTop: 30 },
  info: { marginTop: 10, color: COULEURS.doux },
  erreur: { color: COULEURS.rouge, marginTop: 20 },

  carte: { backgroundColor: COULEURS.carte, borderRadius: 16, padding: 20, marginTop: 24 },
  plat: { fontSize: 22, fontWeight: "700", color: COULEURS.texte },
  boutonFermer: { paddingVertical: 12, marginTop: 8 },
  boutonFermerTexte: { color: COULEURS.doux, fontSize: 15, fontWeight: "600", textAlign: "center" },

  ligneAliment: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COULEURS.bord,
  },
  colGauche: { flex: 1, paddingRight: 12 },
  colDroite: { alignItems: "flex-end" },

  alimentNom: { fontSize: 16, fontWeight: "600", color: COULEURS.texte },
  ficheNom: { fontSize: 13, color: COULEURS.accent, marginTop: 3 },
  chevron: { fontSize: 11 },
  meta: { fontSize: 11, color: COULEURS.doux, marginTop: 2 },
  base: { fontSize: 11, color: COULEURS.doux, marginTop: 3, fontStyle: "italic" },

  champPoids: { flexDirection: "row", alignItems: "center" },
  saisie: {
    minWidth: 52,
    borderWidth: 1,
    borderColor: COULEURS.bord,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 16,
    textAlign: "right",
    color: COULEURS.texte,
    backgroundColor: COULEURS.fond,
  },
  unite: { fontSize: 14, color: COULEURS.doux, marginLeft: 4 },
  alimentKcal: { fontSize: 15, fontWeight: "600", color: COULEURS.texte, marginTop: 6 },

  separateur: { height: 1, backgroundColor: COULEURS.texte, marginTop: 14, marginBottom: 10 },
  ligneTotal: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 18, fontWeight: "700", color: COULEURS.texte },
  totalKcal: { fontSize: 18, fontWeight: "700", color: COULEURS.texte },
  macros: { color: COULEURS.texte, marginTop: 6, fontSize: 14 },
  macrosSecondaires: { color: COULEURS.doux, marginTop: 2, fontSize: 12 },
  remarques: { marginTop: 16, fontStyle: "italic", color: COULEURS.doux, fontSize: 13 },
  source: { marginTop: 16, fontSize: 10, color: COULEURS.doux, textAlign: "center" },

  modale: { flex: 1, backgroundColor: COULEURS.fond, paddingTop: 60, paddingHorizontal: 16 },
  modaleEntete: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modaleTitre: { fontSize: 19, fontWeight: "700", flex: 1, color: COULEURS.texte },
  fermer: { color: COULEURS.accent, fontSize: 16, marginLeft: 12 },
  champRecherche: {
    borderWidth: 1,
    borderColor: COULEURS.bord,
    backgroundColor: COULEURS.carte,
    borderRadius: 10,
    padding: 12,
    marginVertical: 14,
    fontSize: 15,
    color: COULEURS.texte,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: COULEURS.carte,
  },
  optionActive: { borderWidth: 2, borderColor: COULEURS.accent },
  optionNom: { fontSize: 15, color: COULEURS.texte },
  optionMeta: { fontSize: 12, color: COULEURS.doux, marginTop: 3 },
  vide: { textAlign: "center", color: COULEURS.doux, marginTop: 30 },

  // --- Ecran Objectif ---
  champLabel: { fontSize: 13, fontWeight: "600", color: COULEURS.doux, marginBottom: 8, marginTop: 4 },
  noteChamp: { fontSize: 11, color: COULEURS.doux, fontStyle: "italic", marginTop: -4, marginBottom: 8 },

  segment: { flexDirection: "row", gap: 8, marginBottom: 6 },
  segmentColonne: { flexDirection: "column" },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COULEURS.bord,
    backgroundColor: COULEURS.fond,
  },
  segmentBtnColonne: { flex: 0 },
  segmentBtnActif: { backgroundColor: COULEURS.accent, borderColor: COULEURS.accent },
  segmentTexte: { textAlign: "center", color: COULEURS.texte, fontWeight: "600" },
  segmentTexteActif: { color: COULEURS.surAccent },

  ligneChamps: { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 4 },
  champNombre: { flex: 1 },
  champNombreBoite: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COULEURS.bord,
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: COULEURS.fond,
  },
  champNombreSaisie: { flex: 1, paddingVertical: 10, fontSize: 17, color: COULEURS.texte },
  champNombreUnite: { fontSize: 13, color: COULEURS.doux },

  optionActivite: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COULEURS.bord,
    backgroundColor: COULEURS.fond,
    marginBottom: 6,
  },
  optionActiviteActive: { backgroundColor: COULEURS.accent, borderColor: COULEURS.accent },
  optionActiviteTexte: { color: COULEURS.texte, fontSize: 14 },
  optionActiviteTexteActif: { color: COULEURS.surAccent, fontWeight: "600" },

  rythmeApercu: { fontSize: 12, color: COULEURS.doux, marginTop: 2, marginBottom: 2 },

  blocErreurs: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: COULEURS.erreurFond,
  },
  erreurLigne: { color: COULEURS.rouge, fontSize: 13, marginVertical: 1 },

  objectifGros: { fontSize: 40, fontWeight: "800", color: COULEURS.accent, marginTop: 2 },
  objectifSous: { fontSize: 14, color: COULEURS.doux },
  objectifDetail: { fontSize: 13, color: COULEURS.texte, marginTop: 6 },

  barreFond: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COULEURS.piste,
    marginTop: 12,
    overflow: "hidden",
  },
  barreRemplie: { height: 8, borderRadius: 4, backgroundColor: COULEURS.accent },

  gridBesoins: { flexDirection: "row", gap: 10, marginTop: 18, marginBottom: 8 },
  besoinCase: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COULEURS.fond,
  },
  besoinValeur: { fontSize: 20, fontWeight: "700", color: COULEURS.texte },
  besoinLabel: { fontSize: 11, color: COULEURS.doux, textAlign: "center", marginTop: 4 },

  gridMacros: { flexDirection: "row", gap: 10, marginTop: 6, marginBottom: 4 },
  macroCase: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COULEURS.bord,
  },
  macroValeur: { fontSize: 18, fontWeight: "700", color: COULEURS.texte },
  macroLabel: { fontSize: 12, color: COULEURS.doux, marginTop: 3 },

  avertissement: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: COULEURS.avertFond,
    borderWidth: 1,
    borderColor: COULEURS.avertBord,
  },
  avertissementTexte: { fontSize: 13, color: COULEURS.avertTexte, lineHeight: 18 },

  disclaimer: { marginTop: 16, fontSize: 11, color: COULEURS.doux, lineHeight: 16, fontStyle: "italic" },

  // --- Heros / gamification ---
  herosHaut: { flexDirection: "row", alignItems: "center" },
  herosPortrait: {
    width: 120,
    height: 150,
    borderRadius: 12,
    backgroundColor: COULEURS.scene,
    borderWidth: 1,
    borderColor: COULEURS.bord,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  rotationAstuce: {
    position: "absolute",
    bottom: 4,
    fontSize: 9,
    color: COULEURS.fantome,
  },
  herosInfos: { flex: 1, marginLeft: 12 },
  herosNiveau: { fontSize: 22, fontWeight: "800", color: COULEURS.texte },
  herosTitre: { fontSize: 14, fontWeight: "600", color: COULEURS.accent, marginTop: 1 },
  herosXp: { fontSize: 12, color: COULEURS.doux, marginTop: 6 },
  xpFond: { height: 10, borderRadius: 5, backgroundColor: COULEURS.piste, marginTop: 4, overflow: "hidden" },
  xpRempli: { height: 10, borderRadius: 5, backgroundColor: COULEURS.accent },
  herosStreak: { fontSize: 13, color: COULEURS.texte, marginTop: 8, fontWeight: "600" },

  herosZone: { alignItems: "center", marginTop: 12 },
  herosXpBloc: { alignSelf: "stretch", alignItems: "center", paddingBottom: 4 },
  xpFondCentre: { width: "75%", marginTop: 10 },
  astuceCentre: { fontSize: 11, color: COULEURS.doux, textAlign: "center", marginTop: 6 },
  herosTitreCentre: { fontSize: 16, fontWeight: "700", textAlign: "center", marginTop: 8 },
  choixPersoRangee: { flexDirection: "row", gap: 12, marginTop: 24 },
  choixPersoCarte: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COULEURS.bord,
    backgroundColor: COULEURS.carte,
  },
  choixPersoNom: { color: COULEURS.texte, fontSize: 15, fontWeight: "700", marginTop: 8, textAlign: "center" },
  herosNiveauGros: { fontSize: 30, fontWeight: "800", color: COULEURS.texte, textAlign: "center", marginTop: 10 },
  herosXpCentre: { fontSize: 12, color: COULEURS.doux, textAlign: "center", marginTop: 5 },
  herosStreakCentre: { fontSize: 14, color: COULEURS.texte, textAlign: "center", marginTop: 10, fontWeight: "600" },

  badgesZone: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4, justifyContent: "center" },
  badge: {
    width: "22%",
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COULEURS.fond,
  },
  badgeVerrou: { opacity: 0.5 },
  boutonInactif: { opacity: 0.4 },
  badgeEmoji: { fontSize: 22 },
  badgeEmojiVerrou: { fontSize: 18 },
  badgeLibelle: { fontSize: 9, color: COULEURS.doux, textAlign: "center", marginTop: 3 },

  // --- Progression ---
  legendePoids: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  legendePoidsTexte: { fontSize: 13, color: COULEURS.doux },
  legendePoidsDelta: { fontSize: 14, fontWeight: "700" },

  barresZone: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 110,
    marginTop: 10,
  },
  barreCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barreCal: { width: "70%", borderRadius: 3, minHeight: 2 },
  // --- Calendrier du journal ---
  calBloc: { marginTop: 16 },
  calEntete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  calTitre: { fontSize: 18, fontWeight: "800", color: COULEURS.texte, textAlign: "center", flex: 1 },
  calFleche: { fontSize: 30, fontWeight: "300", color: COULEURS.accent, paddingHorizontal: 12, lineHeight: 34 },
  calFlecheInactive: { opacity: 0.2 },
  calSegments: { flexDirection: "row", backgroundColor: COULEURS.piste, borderRadius: 10, padding: 3 },
  calSegment: { flex: 1, paddingVertical: 7, borderRadius: 8 },
  calSegmentTexte: { textAlign: "center", fontSize: 13, fontWeight: "600", color: COULEURS.doux },
  calAide: { flexDirection: "row", justifyContent: "center", minHeight: 18, marginTop: 6, marginBottom: 10 },
  calLigne: { flexDirection: "row" },
  calJourSemaine: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: COULEURS.doux, marginBottom: 4 },
  calCase: { flex: 1, height: 64, alignItems: "center", paddingTop: 4, borderTopWidth: 1, borderTopColor: COULEURS.bord },
  calNumBoite: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  calNum: { fontSize: 15, fontWeight: "600", color: COULEURS.texte },
  calPastille: { width: 7, height: 7, borderRadius: 4, marginTop: 3 },
  calKcal: { fontSize: 9, color: COULEURS.doux, marginTop: 2 },
  calLegende: { flexDirection: "row", justifyContent: "center", gap: 14, marginTop: 10 },
  calLegendeTexte: { fontSize: 11, fontWeight: "600" },
  calAnnee: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  calMiniMois: { width: "31%" },
  calMiniTitre: { fontSize: 13, fontWeight: "800", color: COULEURS.texte, marginBottom: 4 },
  calMiniCase: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  calMiniAujourdhui: { borderWidth: 1.5, borderColor: COULEURS.accent },
  calMiniNum: { fontSize: 8, color: COULEURS.texte },
  calGouttiere: { width: 28 },
  calColEntete: { flex: 1, alignItems: "center", paddingBottom: 4 },
  calColonne: { flex: 1, borderLeftWidth: 1, borderLeftColor: COULEURS.bord },
  calTrait: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: COULEURS.bord },
  calHeure: { position: "absolute", left: 0, fontSize: 9, color: COULEURS.doux },
  calBlocRepas: { position: "absolute", left: 2, right: 2, height: 26, borderRadius: 6, justifyContent: "center" },
  calBlocTexte: { fontSize: 9, fontWeight: "700", textAlign: "center" },
  calRepasLigne: { flexDirection: "row", alignItems: "stretch", marginTop: 8 },
  calRepasHeure: { width: 48, fontSize: 13, fontWeight: "700", color: COULEURS.doux, paddingTop: 10 },
  calRepasBloc: { flex: 1, backgroundColor: COULEURS.carte, borderRadius: 10, padding: 10, borderLeftWidth: 4, borderWidth: 1, borderColor: COULEURS.bord },
  // --- Journal ---
  journalJour: {
    backgroundColor: COULEURS.carte,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COULEURS.bord,
  },
  journalLigneHaut: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  journalDate: { fontSize: 15, fontWeight: "700", color: COULEURS.texte },
  journalVerdict: { fontSize: 12, fontWeight: "700" },
  journalKcal: { fontSize: 22, fontWeight: "800", color: COULEURS.texte, marginTop: 6 },
  journalDetail: { fontSize: 12, fontWeight: "400", color: COULEURS.doux, marginTop: 4 },
  journalBarreFond: { height: 6, borderRadius: 3, backgroundColor: COULEURS.piste, marginTop: 8, overflow: "hidden" },
  journalBarre: { height: 6, borderRadius: 3, backgroundColor: COULEURS.accent },
  journalRepas: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: COULEURS.bord, gap: 4 },
  journalRepasLigne: { fontSize: 13, color: COULEURS.texte },
  barreJour: { fontSize: 9, color: COULEURS.doux, marginTop: 4 },
});
}
let styles = creerStyles();
