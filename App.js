// CalorieCam — photo d'un plat -> calories et macros.
//
// Repartition des roles (voir README) :
//   - gemini.js : l'IA identifie les aliments et estime les portions
//   - ciqual.js : la table officielle de l'ANSES fournit les valeurs nutritionnelles
//   - ce fichier : l'affichage, et la correction manuelle des portions
//
// La correction manuelle est volontairement au premier plan : l'estimation
// visuelle d'une masse reste approximative, donc l'IA propose et l'utilisateur
// ajuste. Un gramme corrige recalcule immediatement tout le reste.

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

export default function App() {
  const [etape, setEtape] = useState(null); // texte affiche pendant le chargement
  const [analyse, setAnalyse] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [editionFiche, setEditionFiche] = useState(null); // index de l'aliment en cours de correction

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

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: COULEURS.fond },
  contenu: { padding: 20, paddingTop: 70, paddingBottom: 60 },

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
});
