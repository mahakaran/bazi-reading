import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { apiFetch, useAuth } from "@/src/auth/AuthContext";
import { Disclaimer } from "@/src/components/Disclaimer";

const FIVE_ELEMENTS = "https://static.prod-images.emergentagent.com/jobs/bd21e9a4-6942-4c32-837d-88bb0dd6eb09/images/b825054c9e15296667be8258b8305c7be40538e9697d6cb6c25e78484e55ade9.png";
const HEX = "https://static.prod-images.emergentagent.com/jobs/bd21e9a4-6942-4c32-837d-88bb0dd6eb09/images/e82e38ff1c401c380b7852bbfc240bab6af8a0a3f35924d0c58fd6ee73026e30.png";

type Section = { title: string; body: string };

function parseSections(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      if (current) sections.push(current);
      current = { title: m[1].trim(), body: "" };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current) sections.push(current);
  return sections.map((s) => ({ ...s, body: s.body.trim() }));
}

const SECTION_ICONS: Record<string, string> = {
  "Overall Energetic Profile": "sparkles-outline",
  "Five Elements Interpretation": "leaf-outline",
  "Personality Pattern": "person-outline",
  "Strengths": "flash-outline",
  "Growth Challenges": "trending-up-outline",
  "Career and Money Themes": "briefcase-outline",
  "Relationship Style": "heart-outline",
  "Life Phase Themes": "time-outline",
  "I Ching Guidance": "compass-outline",
  "Practical Reflection Questions": "help-circle-outline",
  "Disclaimer": "information-circle-outline",
};

export default function ReadingResult() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [reading, setReading] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !token) return;
    apiFetch(token, `/readings/${id}`)
      .then(setReading)
      .catch((e) => setErr(e.message || "Failed to load reading"));
  }, [id, token]);

  if (err) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={styles.errText}>{err}</Text>
      </SafeAreaView>
    );
  }

  if (!reading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <Image source={{ uri: HEX }} style={styles.loadingHex} resizeMode="contain" />
          <ActivityIndicator color={colors.emerald} />
          <Text style={styles.loadingText}>Aligning the elements…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sections = parseSections(reading.generated_text || "");
  const snap = reading.profile_snapshot || {};

  return (
    <SafeAreaView style={styles.root} testID="reading-result-screen">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace("/dashboard")}
            testID="reading-back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.overline}>YOUR READING</Text>
        <Text style={styles.h1}>{snap.name}</Text>
        <Text style={styles.meta}>
          {snap.birth_year}-{String(snap.birth_month).padStart(2, "0")}-
          {String(snap.birth_day).padStart(2, "0")} ·{" "}
          {String(snap.birth_hour).padStart(2, "0")}:
          {String(snap.birth_minute).padStart(2, "0")}
          {snap.birthplace ? ` · ${snap.birthplace}` : ""}
        </Text>

        {sections.map((s, idx) => {
          const icon = SECTION_ICONS[s.title] || "ellipse-outline";
          const heroImg =
            s.title === "Five Elements Interpretation"
              ? FIVE_ELEMENTS
              : s.title === "I Ching Guidance"
              ? HEX
              : null;
          return (
            <View key={idx} style={styles.sectionCard} testID={`section-${idx}`}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionIcon}>
                  <Ionicons name={icon as any} size={16} color={colors.emerald} />
                </View>
                <Text style={styles.sectionTitle}>{s.title}</Text>
              </View>
              {heroImg && (
                <Image source={{ uri: heroImg }} style={styles.sectionImg} resizeMode="contain" />
              )}
              <Text style={styles.sectionBody}>{s.body}</Text>
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => router.replace("/dashboard")}
          testID="reading-done"
        >
          <Text style={styles.doneText}>Back to Dashboard</Text>
        </TouchableOpacity>

        <Disclaimer />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  loadingHex: { width: 80, height: 80, opacity: 0.5 },
  loadingText: { color: colors.textMuted, fontSize: 13, letterSpacing: 1 },
  errText: { color: colors.danger, padding: 24 },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  topRow: { marginBottom: 24 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bgSecondary,
  },
  overline: {
    color: colors.emerald,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "600",
    marginBottom: 8,
  },
  h1: { color: colors.textPrimary, fontSize: 36, fontWeight: "300", marginBottom: 6 },
  meta: { color: colors.textMuted, fontSize: 13, marginBottom: 28 },
  sectionCard: {
    backgroundColor: colors.bgSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(16,185,129,0.12)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderGlow,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "500", flex: 1 },
  sectionImg: {
    width: "100%",
    height: 120,
    marginVertical: 8,
    opacity: 0.85,
  },
  sectionBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 24 },
  doneBtn: {
    backgroundColor: colors.emerald,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 16,
  },
  doneText: { color: "#04130E", fontSize: 15, fontWeight: "700" },
});
