import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { apiFetch, useAuth } from "@/src/auth/AuthContext";
import { Disclaimer } from "@/src/components/Disclaimer";

export default function Compatibility() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch(token, "/birth-profiles")
      .then((ps) => setProfiles(ps || []))
      .finally(() => setLoading(false));
  }, [token]);

  const toggle = (id: string) => {
    setErr(null);
    if (a === id) {
      setA(null);
      return;
    }
    if (b === id) {
      setB(null);
      return;
    }
    if (!a) setA(id);
    else if (!b) setB(id);
    else {
      // both filled — replace the older one (a)
      setA(b);
      setB(id);
    }
  };

  const onGenerate = async () => {
    setErr(null);
    if (!a || !b) {
      setErr("Please select two different people");
      return;
    }
    setBusy(true);
    try {
      const reading = await apiFetch(token, "/readings/compatibility", {
        method: "POST",
        body: JSON.stringify({ profile_id_a: a, profile_id_b: b }),
      });
      router.replace(`/reading/${reading.reading_id}`);
    } catch (e: any) {
      if (e.status === 402) {
        router.replace("/paywall");
        return;
      }
      setErr(e.message || "Failed to generate compatibility reading");
    } finally {
      setBusy(false);
    }
  };

  const orderLabel = (id: string) => (a === id ? "1" : b === id ? "2" : null);

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} testID="compatibility-screen">
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          testID="compat-back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.overline}>PREMIUM · RELATIONSHIP</Text>
        <Text style={styles.h1}>Compatibility{"\n"}reading</Text>
        <Text style={styles.sub}>
          Choose two people from your circle to reflect on their elemental harmony.
        </Text>

        {!user?.is_premium && (
          <View style={styles.lockBox} testID="premium-lock-banner">
            <Ionicons name="lock-closed" size={16} color={colors.gold} />
            <Text style={styles.lockText}>
              Premium feature — upgrade to unlock compatibility readings.
            </Text>
          </View>
        )}

        {profiles.length < 2 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              Add at least 2 people to your circle to generate a compatibility reading.
            </Text>
            <TouchableOpacity
              style={styles.smallBtn}
              onPress={() => router.push("/birth-input")}
              testID="add-second-person"
            >
              <Text style={styles.smallBtnText}>+ Add Person</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {profiles.map((p) => {
              const order = orderLabel(p.profile_id);
              const selected = !!order;
              return (
                <TouchableOpacity
                  key={p.profile_id}
                  style={[styles.row, selected && styles.rowSelected]}
                  onPress={() => toggle(p.profile_id)}
                  testID={`compat-select-${p.profile_id}`}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatar, selected && styles.avatarSelected]}>
                    <Text
                      style={[styles.initial, selected && { color: "#04130E" }]}
                    >
                      {order || (p.name || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{p.name}</Text>
                    <Text style={styles.meta}>
                      {p.birth_year}-{String(p.birth_month).padStart(2, "0")}-
                      {String(p.birth_day).padStart(2, "0")} · {p.birthplace}
                    </Text>
                  </View>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.emerald} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {err && (
          <Text style={styles.err} testID="compat-error">
            {err}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.cta, (busy || !a || !b) && { opacity: 0.5 }]}
          disabled={busy || !a || !b}
          onPress={onGenerate}
          testID="compat-generate"
        >
          {busy ? (
            <ActivityIndicator color="#04130E" />
          ) : (
            <Text style={styles.ctaText}>Generate Compatibility</Text>
          )}
        </TouchableOpacity>

        <Disclaimer />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bgSecondary,
    marginBottom: 24,
  },
  overline: {
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "600",
    marginBottom: 12,
  },
  h1: { color: colors.textPrimary, fontSize: 36, lineHeight: 42, fontWeight: "300", marginBottom: 12 },
  sub: { color: colors.textSecondary, fontSize: 15, marginBottom: 24, opacity: 0.85, lineHeight: 22 },
  lockBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(212,175,55,0.08)",
    borderColor: "rgba(212,175,55,0.3)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  lockText: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  emptyBox: {
    backgroundColor: colors.bgSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 22 },
  smallBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.emerald,
  },
  smallBtnText: { color: colors.emerald, fontSize: 13, fontWeight: "600" },
  list: { gap: 10, marginBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.bgSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  rowSelected: { borderColor: colors.emerald, backgroundColor: "rgba(16,185,129,0.08)" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(16,185,129,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderGlow,
  },
  avatarSelected: { backgroundColor: colors.emerald },
  initial: { color: colors.emerald, fontSize: 18, fontWeight: "700" },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: "500" },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  err: { color: colors.danger, fontSize: 13, marginBottom: 12 },
  cta: {
    backgroundColor: colors.emerald,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  ctaText: { color: "#04130E", fontSize: 15, fontWeight: "700" },
});
