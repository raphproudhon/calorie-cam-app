// CalorieCam — app de test Expo (React Native) — version GRATUITE via Google Gemini
// Prends une photo d'un plat -> envoie a l'API vision de Gemini -> affiche
// plat, ingredients, portions estimees, calories et macros.
//
// Cle API GRATUITE (sans carte bancaire) : https://aistudio.google.com -> "Get API key"
//
// ATTENTION SECURITE : ta cle API est ici en clair dans l'app. C'est OK pour
// tester sur TON iPhone perso, mais ne distribue JAMAIS l'app comme ca.

import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

// La cle API est dans secrets.js (exclu de Git) — voir secrets.example.js.
import { GEMINI_API_KEY } from "./secrets";

const MODELE = "gemini-flash-latest";

// Schema du JSON qu'on veut recevoir (format Gemini : types en MAJUSCULES)
const SCHEMA = {
  type: "OBJECT",
  properties: {
    plat: { type: "STRING" },
    ingredients: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nom: { type: "STRING" },
          quantite_estimee_g: { type: "NUMBER" },
          calories: { type: "NUMBER" },
          proteines_g: { type: "NUMBER" },
          glucides_g: { type: "NUMBER" },
          lipides_g: { type: "NUMBER" },
        },
        required: [
          "nom",
          "quantite_estimee_g",
          "calories",
          "proteines_g",
          "glucides_g",
          "lipides_g",
        ],
      },
    },
    totaux: {
      type: "OBJECT",
      properties: {
        calories: { type: "NUMBER" },
        proteines_g: { type: "NUMBER" },
        glucides_g: { type: "NUMBER" },
        lipides_g: { type: "NUMBER" },
      },
      required: ["calories", "proteines_g", "glucides_g", "lipides_g"],
    },
    confiance: { type: "STRING" },
    remarques: { type: "STRING" },
  },
  required: ["plat", "ingredients", "totaux", "confiance", "remarques"],
};

const PROMPT = `Tu es un nutritionniste expert. Analyse cette photo de plat.
Pour chaque aliment visible : identifie l'ingredient, estime la portion en
grammes (regarde la taille de l'assiette ou des couverts comme reference),
et calcule calories et macros pour cette portion. Puis calcule les totaux.
Sois honnete sur ta confiance ('faible', 'moyenne', 'elevee') et indique tes
hypotheses dans 'remarques'.`;

async function analyserPhoto(base64) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELE}:generateContent` +
    `?key=${GEMINI_API_KEY}`;

  const reponse = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: "image/jpeg", data: base64 } },
            { text: PROMPT },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: "application/json",
        response_schema: SCHEMA,
      },
    }),
  });

  const data = await reponse.json();
  if (data.error) {
    throw new Error(data.error.message || "Erreur API");
  }
  // Gemini peut renvoyer plusieurs "parts" : on recupere tout le texte.
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const texte = parts.map((p) => p.text).filter(Boolean).join("");
  if (!texte) {
    throw new Error("Reponse vide : " + JSON.stringify(data).slice(0, 400));
  }
  return JSON.parse(texte);
}

export default function App() {
  const [chargement, setChargement] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);

  async function lancer(source) {
    setErreur(null);
    setResultat(null);

    const options = { base64: true, quality: 0.5, allowsEditing: false };
    const res =
      source === "camera"
        ? await (async () => {
            await ImagePicker.requestCameraPermissionsAsync();
            return ImagePicker.launchCameraAsync(options);
          })()
        : await ImagePicker.launchImageLibraryAsync(options);

    if (res.canceled) return;

    setChargement(true);
    try {
      const analyse = await analyserPhoto(res.assets[0].base64);
      setResultat(analyse);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titre}>CalorieCam</Text>

      <TouchableOpacity style={styles.bouton} onPress={() => lancer("camera")}>
        <Text style={styles.boutonTexte}>Prendre une photo</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.bouton, styles.boutonSecondaire]}
        onPress={() => lancer("galerie")}
      >
        <Text style={styles.boutonTexte}>Choisir dans la galerie</Text>
      </TouchableOpacity>

      {chargement && (
        <View style={styles.centre}>
          <ActivityIndicator size="large" />
          <Text style={styles.info}>Analyse en cours...</Text>
        </View>
      )}

      {erreur && <Text style={styles.erreur}>Erreur : {erreur}</Text>}

      {resultat && Array.isArray(resultat.ingredients) && (
        <View style={styles.carte}>
          <Text style={styles.plat}>{resultat.plat}</Text>
          <Text style={styles.confiance}>Confiance : {resultat.confiance}</Text>

          {resultat.ingredients.map((ing, i) => (
            <View key={i} style={styles.ligne}>
              <Text style={styles.ingNom}>
                {ing.nom} ({Math.round(ing.quantite_estimee_g)}g)
              </Text>
              <Text style={styles.ingKcal}>{Math.round(ing.calories)} kcal</Text>
            </View>
          ))}

          <View style={styles.separateur} />
          <View style={styles.ligne}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalKcal}>
              {Math.round(resultat.totaux?.calories || 0)} kcal
            </Text>
          </View>
          <Text style={styles.macros}>
            P {Math.round(resultat.totaux?.proteines_g || 0)}g · G{" "}
            {Math.round(resultat.totaux?.glucides_g || 0)}g · L{" "}
            {Math.round(resultat.totaux?.lipides_g || 0)}g
          </Text>

          {resultat.remarques ? (
            <Text style={styles.remarques}>{resultat.remarques}</Text>
          ) : null}
        </View>
      )}

      {resultat && !Array.isArray(resultat.ingredients) && (
        <View style={styles.carte}>
          <Text style={styles.plat}>Reponse inattendue</Text>
          <Text style={styles.remarques}>{JSON.stringify(resultat, null, 2)}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 80, backgroundColor: "#F4F1EA" },
  titre: { fontSize: 32, fontWeight: "700", marginBottom: 24, textAlign: "center" },
  bouton: {
    backgroundColor: "#C4622D",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  boutonSecondaire: { backgroundColor: "#8A8578" },
  boutonTexte: { color: "white", fontSize: 16, fontWeight: "600", textAlign: "center" },
  centre: { alignItems: "center", marginTop: 30 },
  info: { marginTop: 10, color: "#555" },
  erreur: { color: "#B00020", marginTop: 20 },
  carte: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
  },
  plat: { fontSize: 22, fontWeight: "700" },
  confiance: { color: "#888", marginBottom: 16 },
  ligne: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  ingNom: { flex: 1, fontSize: 15 },
  ingKcal: { fontSize: 15, color: "#555" },
  separateur: { height: 1, backgroundColor: "#eee", marginVertical: 8 },
  totalLabel: { fontSize: 17, fontWeight: "700" },
  totalKcal: { fontSize: 17, fontWeight: "700" },
  macros: { color: "#888", marginTop: 4 },
  remarques: { marginTop: 16, fontStyle: "italic", color: "#666", fontSize: 13 },
});
