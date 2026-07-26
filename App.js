// CalorieCam — deux ecrans :
//   - "Photo"    : photo d'un plat -> calories et macros (voir gemini.js/ciqual.js)
//   - "Objectif" : calculateur de besoin calorique selon un but (perte/prise)
//
// Repartition des roles (voir README) :
//   - gemini.js  : l'IA identifie les aliments et estime les portions
//   - ciqual.js  : la table officielle de l'ANSES fournit les valeurs nutritionnelles
//   - besoins.js : calcul du besoin calorique et de l'objectif, avec garde-fous
//   - ce fichier : l'affichage
//
// La correction manuelle des portions est volontairement au premier plan :
// l'estimation visuelle d'une masse reste approximative, donc l'IA propose et
// l'utilisateur ajuste. Un gramme corrige recalcule immediatement tout le reste.

import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import { analyserPhoto } from "./gemini";
import { calculer, totaliser, rechercher, NB_ALIMENTS, SOURCE } from "./ciqual";
import { ACTIVITES, RYTHMES, calculerObjectif, bilanJournalier } from "./besoins";
import { estDisponible as santeDisponible, demanderAcces, depenseDuJour } from "./health";

// --- Navigation par onglets ------------------------------------------------

export default function App() {
  const [onglet, setOnglet] = useState("photo");

  // Etat partage entre les onglets pour le bilan du jour :
  //   - objectifInfo : l'objectif calorique calcule dans l'onglet Objectif
  //   - consomme     : cumul des calories envoyees depuis l'onglet Photo
  const [objectifInfo, setObjectifInfo] = useState(null); // { objectif, cleActivite }
  const [consomme, setConsomme] = useState(0);

  const ajouterConsomme = (kcal) => setConsomme((c) => c + Math.max(0, Math.round(kcal || 0)));

  return (
    <View style={styles.ecran}>
      <View style={styles.tabs}>
        {[
          ["photo", "Photo"],
          ["objectif", "Objectif"],
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

      {onglet === "photo" && <EcranPhoto onAjouterConsomme={ajouterConsomme} />}
      {onglet === "objectif" && <EcranObjectif onObjectif={setObjectifInfo} />}
      {onglet === "bilan" && (
        <EcranBilan
          objectifInfo={objectifInfo}
          consomme={consomme}
          onResetConsomme={() => setConsomme(0)}
          allerObjectif={() => setOnglet("objectif")}
        />
      )}
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

  async function lancer(source) {
    setErreur(null);
    setAnalyse(null);

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
    if (res.canceled) return;

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
              changer d'aliment.
            </Text>

            {analyse.aliments.map((al, i) => (
              <LigneAliment
                key={`${analyse.id}-${i}`}
                aliment={al}
                portion={portions[i]}
                onGrammes={(g) => modifierAliment(i, { grammes: g })}
                onOuvrirFiches={() => setEditionFiche(i)}
              />
            ))}

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
    </View>
  );
}

/** Une ligne d'aliment : poids modifiable, fiche CIQUAL, calories calculees. */
function LigneAliment({ aliment, portion, onGrammes, onOuvrirFiches }) {
  const [saisie, setSaisie] = useState(String(aliment.grammes));

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

function EcranObjectif({ onObjectif }) {
  const [sexe, setSexe] = useState("homme");
  const [age, setAge] = useState("");
  const [poids, setPoids] = useState("");
  const [taille, setTaille] = useState("");
  const [activite, setActivite] = useState("modere");
  const [but, setBut] = useState("perte");
  const [rythme, setRythme] = useState("standard");
  const [resultat, setResultat] = useState(null);
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
    } else {
      setErreurs([]);
      setResultat(r);
      // Publie l'objectif vers l'onglet Bilan (avec l'activite, pour detecter
      // un eventuel double comptage du sport).
      onObjectif?.({ objectif: r.objectif, cleActivite: activite });
    }
  }

  // Les rythmes n'ont de sens que pour perte / prise.
  const rythmesDispo = but === "maintien" ? null : RYTHMES[but];

  return (
    <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
      <Text style={styles.titre}>Mon objectif</Text>
      <Text style={styles.sousTitre}>
        Besoin calorique estimé à partir de votre profil, avec des marges de
        sécurité
      </Text>

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
    </ScrollView>
  );
}

// =========================================================================
//  ECRAN BILAN — calories restantes du jour (objectif + sport - consomme)
// =========================================================================

function EcranBilan({ objectifInfo, consomme, onResetConsomme, allerObjectif }) {
  // Sport du jour : saisi a la main, ou importe depuis Apple Sante (energie
  // active) quand un build de developpement le permet.
  const [sport, setSport] = useState("");
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
      if (d.active != null) setSport(String(d.active));
      setEtatSante("depart");
    } catch (e) {
      setErreurSante(e.message);
      setEtatSante("depart");
    }
  }

  const objectif = objectifInfo?.objectif ?? null;
  const bilan = objectif
    ? bilanJournalier({
        objectif,
        sport: parseInt(sport || "0", 10),
        consomme,
      })
    : null;

  return (
    <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
      <Text style={styles.titre}>Bilan du jour</Text>
      <Text style={styles.sousTitre}>
        Ce qu'il vous reste à manger = objectif + sport − déjà consommé
      </Text>

      {!objectif ? (
        <View style={styles.carte}>
          <Text style={styles.disclaimer}>
            Calculez d'abord votre objectif calorique dans l'onglet Objectif.
          </Text>
          <TouchableOpacity style={[styles.bouton, { marginTop: 12 }]} onPress={allerObjectif}>
            <Text style={styles.boutonTexte}>Aller à l'onglet Objectif</Text>
          </TouchableOpacity>
        </View>
      ) : (
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
                onChangeText={(t) => setSport(t.replace(/[^0-9]/g, ""))}
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
            {consomme > 0 ? (
              <TouchableOpacity
                style={[styles.bouton, styles.boutonSecondaire, { marginTop: 12 }]}
                onPress={onResetConsomme}
              >
                <Text style={styles.boutonTexte}>Remettre à zéro (nouveau jour)</Text>
              </TouchableOpacity>
            ) : null}
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

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: COULEURS.fond },
  contenu: { padding: 20, paddingTop: 16, paddingBottom: 60 },

  tabs: {
    flexDirection: "row",
    paddingTop: 56,
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
  tabTexte: { textAlign: "center", fontWeight: "600", color: COULEURS.doux },
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
  boutonTexte: { color: "white", fontSize: 16, fontWeight: "600", textAlign: "center" },

  centre: { alignItems: "center", marginTop: 30 },
  info: { marginTop: 10, color: COULEURS.doux },
  erreur: { color: "#B00020", marginTop: 20 },

  carte: { backgroundColor: COULEURS.carte, borderRadius: 16, padding: 20, marginTop: 24 },
  plat: { fontSize: 22, fontWeight: "700", color: COULEURS.texte },
  aide: { fontSize: 12, color: COULEURS.doux, marginTop: 4, marginBottom: 14 },

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
});
