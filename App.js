// CalorieCam — onglets :
//   - "Photo"       : photo d'un plat -> calories et macros (gemini.js/ciqual.js)
//   - "Progression" : courbe de poids + historique des calories jour par jour
//   - "Bilan"       : calories restantes du jour (objectif + sport - consomme)
// L'objectif se regle au premier lancement (onboarding), puis via la roue
// crantee en haut a gauche (menu parametres).
//
// Repartition des roles (voir README) :
//   - gemini.js   : l'IA identifie les aliments et estime les portions
//   - ciqual.js   : la table officielle de l'ANSES fournit les valeurs nutritionnelles
//   - besoins.js  : calcul du besoin calorique et de l'objectif, avec garde-fous
//   - stockage.js : persistance locale (profil, historique, poids) + bascule de jour
//   - ce fichier  : l'affichage

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Polyline, Circle, Line as SvgLine } from "react-native-svg";

import { analyserPhoto } from "./gemini";
import { produitParCodeBarres, analyseDepuisProduit, alimentDepuisProduit } from "./off";
import { calculer, totaliser, rechercher, NB_ALIMENTS, SOURCE } from "./ciqual";
import { ACTIVITES, RYTHMES, calculerObjectif, bilanJournalier } from "./besoins";
import { estDisponible as santeDisponible, demanderAcces, depenseDuJour } from "./health";
import { chargerEtat, sauvegarderEtat, dateDuJour } from "./stockage";
import {
  niveauDepuisXp,
  etapePersonnage,
  NOMS_ETAPES,
  BADGES,
  recompenserPesee,
  ajouterXp,
  jeuParDefaut,
} from "./jeu";

// --- Racine : chargement, onboarding, navigation ---------------------------

export default function App() {
  const [etat, setEtat] = useState(null); // null = en cours de chargement
  const [onglet, setOnglet] = useState("photo");
  const [paramsOuverts, setParamsOuverts] = useState(false);

  // Chargement de l'etat persiste (profil, historique, poids) au demarrage.
  // chargerEtat applique aussi la bascule de journee (archivage de la veille).
  useEffect(() => {
    chargerEtat().then(setEtat);
  }, []);

  // Sauvegarde a chaque modification de l'etat (une fois charge).
  useEffect(() => {
    if (etat) sauvegarderEtat(etat);
  }, [etat]);

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

  // --- Application principale ---
  const majJour = (champs) =>
    setEtat((e) => ({ ...e, jour: { ...e.jour, ...champs } }));

  const ajouterConsomme = (kcal) =>
    majJour({ consomme: (etat.jour.consomme || 0) + Math.max(0, Math.round(kcal || 0)) });

  return (
    <View style={styles.ecran}>
      {/* Barre du haut : roue crantee (parametres) a gauche + titre */}
      <View style={styles.barreHaut}>
        <Pressable onPress={() => setParamsOuverts(true)} hitSlop={12} style={styles.rouePos}>
          <Text style={styles.roue}>⚙︎</Text>
        </Pressable>
        <Text style={styles.barreTitre}>CalorieCam</Text>
      </View>

      <View style={styles.tabs}>
        {[
          ["photo", "Photo"],
          ["progression", "Progression"],
          ["bilan", "Bilan"],
        ].map(([cle, libelle]) => (
          <Pressable
            key={cle}
            style={[styles.tab, onglet === cle && styles.tabActif]}
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
        onResetJour={() => majJour({ consomme: 0, sport: "" })}
        onDevXp={(m) => setEtat((e) => ({ ...e, jeu: ajouterXp(e.jeu, m) }))}
        onResetHeros={() => setEtat((e) => ({ ...e, jeu: jeuParDefaut() }))}
      />
    </View>
  );
}

const COULEURS = {
  fond: "#F4F1EA",
  accent: "#C4622D",
  secondaire: "#8A8578",
  texte: "#2B2925",
  doux: "#7A756C",
  carte: "#FFFFFF",
  bord: "#E8E3D8",
};

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
  const [etape, setEtape] = useState(null); // texte affiche pendant le chargement
  const [analyse, setAnalyse] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [editionFiche, setEditionFiche] = useState(null); // index de l'aliment en cours de correction
  const [ajoute, setAjoute] = useState(false); // ce plat a-t-il ete envoye au bilan ?
  const [scanOuvert, setScanOuvert] = useState(false);
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

        <TouchableOpacity style={styles.bouton} onPress={() => lancer("camera")}>
          <Text style={styles.boutonTexte}>Prendre une photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bouton, styles.boutonSecondaire]}
          onPress={() => lancer("galerie")}
        >
          <Text style={styles.boutonTexte}>Choisir dans la galerie</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bouton, styles.boutonScan]}
          onPress={() => ouvrirScanner(false)}
        >
          <Text style={styles.boutonTexte}>Scanner un code-barres</Text>
        </TouchableOpacity>

        {etape && (
          <View style={styles.centre}>
            <ActivityIndicator size="large" color={COULEURS.accent} />
            <Text style={styles.info}>{etape}</Text>
          </View>
        )}

        {erreur && <Text style={styles.erreur}>Erreur : {erreur}</Text>}

        {analyse && (
          <View style={styles.carte}>
            <Text style={styles.plat}>{analyse.plat}</Text>
            <Text style={styles.aide}>
              Touchez un poids pour le corriger, ou le nom de la fiche pour
              changer d'aliment. Le résultat reste ici, même si vous changez
              d'onglet, jusqu'à ce que vous le fermiez.
            </Text>

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
              style={[styles.bouton, ajoute && styles.boutonSecondaire, { marginTop: 16 }]}
              onPress={() => {
                if (ajoute) return;
                onAjouterConsomme?.(totaux.kcal);
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
function ChoixFiche({ visible, aliment, onChoisir, onFermer }) {
  const [recherche, setRecherche] = useState("");

  const liste = useMemo(() => {
    if (!aliment) return [];
    // Tant que l'utilisateur n'a rien tape, on montre les candidates deja
    // calculees ; des qu'il tape, on cherche dans toute la table.
    return recherche.trim().length >= 2
      ? rechercher(recherche, 25)
      : aliment.candidates;
  }, [aliment, recherche]);

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
          placeholder="Chercher un aliment dans la table Ciqual…"
          placeholderTextColor={COULEURS.doux}
          autoCorrect={false}
        />

        <ScrollView>
          {liste.length === 0 ? (
            <Text style={styles.vide}>Aucun aliment trouvé.</Text>
          ) : (
            liste.map((f) => {
              const actif = aliment?.fiche?.code === f.code;
              return (
                <Pressable
                  key={f.code}
                  style={[styles.option, actif && styles.optionActive]}
                  onPress={() => {
                    setRecherche("");
                    onChoisir(f);
                  }}
                >
                  <Text style={styles.optionNom}>{f.nom}</Text>
                  <Text style={styles.optionMeta}>
                    {f.kcal} kcal/100 g · P {f.prot ?? "?"} · G {f.gluc ?? "?"} · L{" "}
                    {f.lip ?? "?"}
                    {f.groupe ? ` · ${f.groupe}` : ""}
                  </Text>
                </Pressable>
              );
            })
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

        <TouchableOpacity style={[styles.bouton, { marginTop: 20 }]} onPress={calculer}>
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
          style={[styles.bouton, { marginTop: 4, marginBottom: 20 }]}
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

function MenuParametres({ visible, etat, onFermer, onModifierObjectif, onAjouterPoids, onResetJour, onDevXp, onResetHeros }) {
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
          <ScrollView keyboardShouldPersistTaps="handled">
            {/* Objectif actuel */}
            <View style={styles.carte}>
              <Text style={styles.champLabel}>Objectif quotidien</Text>
              <Text style={styles.objectifGros}>{etat.objectif} kcal</Text>
              <TouchableOpacity
                style={[styles.bouton, { marginTop: 12 }]}
                onPress={() => setVue("objectif")}
              >
                <Text style={styles.boutonTexte}>Modifier mon objectif</Text>
              </TouchableOpacity>
            </View>

            {/* Saisie du poids */}
            <View style={styles.carte}>
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
            <View style={styles.carte}>
              <Text style={styles.champLabel}>Journée en cours</Text>
              <TouchableOpacity
                style={[styles.bouton, styles.boutonSecondaire]}
                onPress={onResetJour}
              >
                <Text style={styles.boutonTexte}>Remettre le jour à zéro</Text>
              </TouchableOpacity>
            </View>

            {/* Section de TEST — visible uniquement en mode developpement
                (Expo Go), jamais dans un build de production. Permet de voir le
                personnage evoluer sans attendre l'XP reelle. */}
            {typeof __DEV__ !== "undefined" && __DEV__ ? (
              <View style={[styles.carte, { borderWidth: 1, borderColor: COULEURS.accent }]}>
                <Text style={styles.champLabel}>🧪 Test (mode développeur)</Text>
                <Text style={styles.objectifDetail}>
                  Niveau {niveauDepuisXp(etat.jeu.xp).niveau} · {etat.jeu.xp} XP ·
                  étape {etapePersonnage(niveauDepuisXp(etat.jeu.xp).niveau) + 1}/10
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
              </View>
            ) : null}

            {/* Apple Sante */}
            <View style={styles.carte}>
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
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// =========================================================================
//  ECRAN BILAN — calories restantes du jour (objectif + sport - consomme)
// =========================================================================

function EcranBilan({ objectif, consomme, sport, onSport }) {
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
    <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
      <Text style={styles.titre}>Bilan du jour</Text>
      <Text style={styles.sousTitre}>
        Ce qu'il vous reste à manger = objectif + sport − déjà consommé
      </Text>

      {(
        <>
          <View style={styles.carte}>
            <Text style={styles.champLabel}>Il vous reste</Text>
            <Text
              style={[
                styles.objectifGros,
                bilan.restant < 0 && { color: "#B00020" },
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
                  bilan.restant < 0 && { backgroundColor: "#B00020" },
                ]}
              />
            </View>

            <View style={styles.gridBesoins}>
              <View style={styles.besoinCase}>
                <Text style={styles.besoinValeur}>{objectif}</Text>
                <Text style={styles.besoinLabel}>objectif{"\n"}de base</Text>
              </View>
              <View style={styles.besoinCase}>
                <Text style={[styles.besoinValeur, { color: "#2E7D32" }]}>
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

          <View style={styles.carte}>
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

          <View style={styles.carte}>
            <Text style={styles.champLabel}>Consommé aujourd'hui</Text>
            <Text style={styles.objectifDetail}>
              {consomme} kcal ajoutées depuis l'onglet Photo. Analysez un plat
              puis touchez « Ajouter au bilan » pour l'inclure ici.
            </Text>
            <Text style={[styles.disclaimer, { marginTop: 8 }]}>
              La journée est archivée automatiquement à minuit. Pour repartir à
              zéro manuellement, utilisez la roue crantée (Paramètres).
            </Text>
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

function EcranProgression({ etat }) {
  const poids = etat.poids || [];
  const historique = etat.historique || [];

  // But (perte/prise/maintien) pour orienter la lecture de la courbe de poids.
  const but = etat.profil?.but;

  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <Text style={styles.titre}>Progression</Text>
      <Text style={styles.sousTitre}>Votre poids et vos calories dans le temps</Text>

      {/* --- Personnage & niveau --- */}
      <CarteHeros jeu={etat.jeu} />

      {/* --- Courbe de poids --- */}
      <View style={styles.carte}>
        <Text style={styles.champLabel}>Poids</Text>
        {poids.length < 2 ? (
          <Text style={styles.objectifDetail}>
            {poids.length === 0
              ? "Aucun poids enregistré. Ajoutez-en un via la roue crantée (Paramètres)."
              : `Un seul point (${poids[0].valeur} kg). Ajoutez-en d'autres pour voir la courbe.`}
          </Text>
        ) : (
          <CourbePoids poids={poids} but={but} />
        )}
      </View>

      {/* --- Historique des calories --- */}
      <View style={styles.carte}>
        <Text style={styles.champLabel}>Calories des derniers jours</Text>
        {historique.length === 0 ? (
          <Text style={styles.objectifDetail}>
            L'historique se remplit tout seul : chaque jour terminé est archivé
            ici (consommé vs objectif).
          </Text>
        ) : (
          <BarresCalories historique={historique} />
        )}
      </View>
    </ScrollView>
  );
}

// Les 10 etapes du heros (images decoupees de assets/hero-sheet.png par
// tools/slice-hero.js). L'index correspond a etapePersonnage() (0..9).
const HERO_FRAMES = [
  require("./assets/hero/01.png"),
  require("./assets/hero/02.png"),
  require("./assets/hero/03.png"),
  require("./assets/hero/04.png"),
  require("./assets/hero/05.png"),
  require("./assets/hero/06.png"),
  require("./assets/hero/07.png"),
  require("./assets/hero/08.png"),
  require("./assets/hero/09.png"),
  require("./assets/hero/10.png"),
];

// Les 8 angles du personnage PAR NIVEAU (extraits des GIF PixelLab par
// tools/extract-rotations.js). Un jeu de 8 frames par etape de personnage.
// On complete au fur et a mesure qu'on genere les niveaux ; les etapes sans
// art encore genere retombent sur le dernier jeu disponible.
const ROT_NIVEAU_1 = [
  require("./assets/hero/rot/0.png"),
  require("./assets/hero/rot/1.png"),
  require("./assets/hero/rot/2.png"),
  require("./assets/hero/rot/3.png"),
  require("./assets/hero/rot/4.png"),
  require("./assets/hero/rot/5.png"),
  require("./assets/hero/rot/6.png"),
  require("./assets/hero/rot/7.png"),
];
const ROT_NIVEAU_2 = [
  require("./assets/hero/rot2/0.png"),
  require("./assets/hero/rot2/1.png"),
  require("./assets/hero/rot2/2.png"),
  require("./assets/hero/rot2/3.png"),
  require("./assets/hero/rot2/4.png"),
  require("./assets/hero/rot2/5.png"),
  require("./assets/hero/rot2/6.png"),
  require("./assets/hero/rot2/7.png"),
];
const ROT_NIVEAU_3 = [
  require("./assets/hero/rot3/0.png"),
  require("./assets/hero/rot3/1.png"),
  require("./assets/hero/rot3/2.png"),
  require("./assets/hero/rot3/3.png"),
  require("./assets/hero/rot3/4.png"),
  require("./assets/hero/rot3/5.png"),
  require("./assets/hero/rot3/6.png"),
  require("./assets/hero/rot3/7.png"),
];

// Un jeu de rotations par etape (index = etapePersonnage 0..9). Tant que les
// niveaux superieurs ne sont pas dessines, on garde le dernier jeu disponible.
const ROT_SETS = [ROT_NIVEAU_1, ROT_NIVEAU_2, ROT_NIVEAU_3];

/** Jeu de rotations a afficher pour une etape de personnage donnee. */
function rotationsPourEtape(etape) {
  return ROT_SETS[Math.min(etape, ROT_SETS.length - 1)];
}

/**
 * Avatar que l'utilisateur peut faire tourner sur lui-meme : on glisse le doigt
 * horizontalement pour parcourir les 8 angles. Chaque tranche de deplacement
 * fait avancer d'un angle ; ca boucle. Aucune dependance (PanResponder natif).
 */
function AvatarRotatif({ frames = ROT_NIVEAU_1, taille = 128, style }) {
  const [angle, setAngle] = useState(0);
  const angleRef = useRef(0);      // valeur courante, lisible dans le geste
  const baseRef = useRef(0);       // angle au debut du glissement

  const maj = (i) => {
    const n = ((i % frames.length) + frames.length) % frames.length;
    angleRef.current = n;
    setAngle(n);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3,
      onPanResponderGrant: () => { baseRef.current = angleRef.current; },
      onPanResponderMove: (_e, g) => {
        // ~22 px de glissement = un angle. Glisser vers la droite fait tourner
        // le personnage vers la droite (sens naturel du geste).
        maj(baseRef.current + Math.round(g.dx / 22));
      },
    })
  ).current;

  return (
    <View style={style} {...pan.panHandlers}>
      <Image
        source={frames[angle]}
        style={{ width: taille * 0.72, height: taille }}
        resizeMode="contain"
        fadeDuration={0}
      />
    </View>
  );
}

/** Carte du heros : niveau, barre d'XP, personnage evolutif, badges. */
function CarteHeros({ jeu }) {
  const j = jeu || { xp: 0, streak: 0, badges: [] };
  const niv = niveauDepuisXp(j.xp);
  const etape = etapePersonnage(niv.niveau);
  const badgesAcquis = new Set(j.badges || []);

  return (
    <View style={styles.carte}>
      <View style={styles.herosHaut}>
        <View style={styles.herosPortrait}>
          <AvatarRotatif frames={rotationsPourEtape(etape)} taille={118} style={styles.centreEcran} />
          <Text style={styles.rotationAstuce}>glissez pour tourner</Text>
        </View>
        <View style={styles.herosInfos}>
          <Text style={styles.herosNiveau}>Niveau {niv.niveau}</Text>
          <Text style={styles.herosTitre}>{NOMS_ETAPES[etape]}</Text>
          <Text style={styles.herosXp}>
            {niv.xpDansNiveau} / {niv.xpNiveau} XP
          </Text>
          {/* Barre d'XP */}
          <View style={styles.xpFond}>
            <View style={[styles.xpRempli, { width: `${Math.round(niv.progression * 100)}%` }]} />
          </View>
          {j.streak > 0 ? (
            <Text style={styles.herosStreak}>🔥 Série : {j.streak} jour{j.streak > 1 ? "s" : ""}</Text>
          ) : null}
        </View>
      </View>

      {/* Badges */}
      <Text style={[styles.champLabel, { marginTop: 14 }]}>Badges</Text>
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
        <Text style={[styles.legendePoidsDelta, { color: bonSens ? "#2E7D32" : "#B00020" }]}>
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
                { height: hauteur, backgroundColor: depasse ? "#B00020" : "#2E7D32" },
              ]}
            />
            <Text style={styles.barreJour}>{jourNum}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: 4,
    backgroundColor: COULEURS.fond,
  },
  rouePos: { position: "absolute", left: 16, top: 50, padding: 6 },
  roue: { fontSize: 24, color: COULEURS.texte },
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
    backgroundColor: "#EAE5DA",
  },
  tabActif: { backgroundColor: COULEURS.accent },
  tabTexte: { textAlign: "center", fontWeight: "600", color: COULEURS.doux, fontSize: 13 },
  tabTexteActif: { color: "white" },

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
  boutonScan: { backgroundColor: "#4A7C59" },
  boutonAjoutScan: {
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4A7C59",
    alignItems: "center",
  },
  boutonAjoutScanTexte: { color: "#4A7C59", fontWeight: "600" },
  supprimer: { color: "#B00020", fontSize: 12, marginTop: 6 },
  boutonTexte: { color: "white", fontSize: 16, fontWeight: "600", textAlign: "center" },
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
  erreur: { color: "#B00020", marginTop: 20 },

  carte: { backgroundColor: COULEURS.carte, borderRadius: 16, padding: 20, marginTop: 24 },
  plat: { fontSize: 22, fontWeight: "700", color: COULEURS.texte },
  aide: { fontSize: 12, color: COULEURS.doux, marginTop: 4, marginBottom: 14 },
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
  segmentTexteActif: { color: "white" },

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
  optionActiviteTexteActif: { color: "white", fontWeight: "600" },

  rythmeApercu: { fontSize: 12, color: COULEURS.doux, marginTop: 2, marginBottom: 2 },

  blocErreurs: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FBEAEA",
  },
  erreurLigne: { color: "#B00020", fontSize: 13, marginVertical: 1 },

  objectifGros: { fontSize: 40, fontWeight: "800", color: COULEURS.accent, marginTop: 2 },
  objectifSous: { fontSize: 14, color: COULEURS.doux },
  objectifDetail: { fontSize: 13, color: COULEURS.texte, marginTop: 6 },

  barreFond: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EAE5DA",
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
    backgroundColor: "#FFF4E5",
    borderWidth: 1,
    borderColor: "#F0D9B8",
  },
  avertissementTexte: { fontSize: 13, color: "#7A4B12", lineHeight: 18 },

  disclaimer: { marginTop: 16, fontSize: 11, color: COULEURS.doux, lineHeight: 16, fontStyle: "italic" },

  // --- Heros / gamification ---
  herosHaut: { flexDirection: "row", alignItems: "center" },
  herosPortrait: {
    width: 120,
    height: 150,
    borderRadius: 12,
    backgroundColor: "#161320",
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
    color: "#ffffff88",
  },
  herosInfos: { flex: 1, marginLeft: 12 },
  herosNiveau: { fontSize: 22, fontWeight: "800", color: COULEURS.texte },
  herosTitre: { fontSize: 14, fontWeight: "600", color: COULEURS.accent, marginTop: 1 },
  herosXp: { fontSize: 12, color: COULEURS.doux, marginTop: 6 },
  xpFond: { height: 10, borderRadius: 5, backgroundColor: "#EAE5DA", marginTop: 4, overflow: "hidden" },
  xpRempli: { height: 10, borderRadius: 5, backgroundColor: COULEURS.accent },
  herosStreak: { fontSize: 13, color: COULEURS.texte, marginTop: 8, fontWeight: "600" },

  badgesZone: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  badge: {
    width: "22%",
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COULEURS.fond,
  },
  badgeVerrou: { opacity: 0.5 },
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
  barreJour: { fontSize: 9, color: COULEURS.doux, marginTop: 4 },
});
