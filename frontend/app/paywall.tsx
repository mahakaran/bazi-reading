import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { apiFetch, useAuth } from "@/src/auth/AuthContext";
import { Disclaimer } from "@/src/components/Disclaimer";

const HERO = "https://static.prod-images.emergentagent.com/jobs/bd21e9a4-6942-4c32-837d-88bb0dd6eb09/images/5f0ad2d1f3ddacdef166948fbc8d45a0cbfcbe4617646a73aa2e9e479baf9a23.png";

const PERKS = [
  "Unlimited personal readings",
  "Add multiple people to your circle",
  "Save full reading history",
  "Compatibility readings (coming)",
];

export default function Paywall() {
  const router = useRouter();
  const { token, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const startCheckout = async () => {
    setErr(null);
    setBusy(true);
    try {
      const origin =
        Platform.OS === "web" && typeof window !== "undefined"
          ? window.location.origin
          : process.env.EXPO_PUBLIC_BACKEND_URL || "";
      const res = await apiFetch(token, "/stripe/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({ origin_url: origin }),
      });

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.location.href = res.url;
      } else {
        const result = await WebBrowser.openBrowserAsync(res.url);
        // After browser closes, poll
        setPolling(true);
        await pollUntilPaid(res.session_id);
        setPolling(false);
        await refresh();
        if (result) router.replace("/dashboard");
      }
    } catch (e: any) {
      setErr(e.message || "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  const pollUntilPaid = async (sessionId: string, attempts = 12) => {
    for (let i = 0; i < attempts; i++) {
      try {
        const s = await apiFetch(token, `/stripe/session/${sessionId}`);
        if (s.payment_status === "paid") return true;
      } catch {}
      await new Promise((r) => setTimeout(r, 2500));
    }
    return false;
  };

  return (
    <View style={styles.root} testID="paywall-screen">
      <ImageBackground source={{ uri: HERO }} style={StyleSheet.absoluteFill} resizeMode="cover">
        <LinearGradient
          colors={["rgba(4,9,7,0.5)", "rgba(4,9,7,0.95)", colors.bg]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            testID="paywall-back"
          >
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.crest}>
            <Ionicons name="star" size={24} color={colors.gold} />
          </View>

          <Text style={styles.overline}>UNLOCK DEEPER SECRETS</Text>
          <Text style={styles.h1}>Premium{"\n"}Membership</Text>
          <Text style={styles.lede}>
            Upgrade to Premium to add more people and unlock deeper compatibility readings.
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceAmount}>$9.99</Text>
            <Text style={styles.pricePeriod}> / month</Text>
          </View>

          <View style={styles.perks}>
            {PERKS.map((p) => (
              <View key={p} style={styles.perkRow}>
                <View style={styles.perkDot}>
                  <Ionicons name="checkmark" size={14} color={colors.emerald} />
                </View>
                <Text style={styles.perkText}>{p}</Text>
              </View>
            ))}
          </View>

          {err && (
            <Text style={styles.err} testID="paywall-error">
              {err}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.cta, busy && { opacity: 0.7 }]}
            onPress={startCheckout}
            disabled={busy || polling}
            testID="paywall-upgrade"
          >
            {busy || polling ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.ctaText}>Upgrade to Premium</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace("/dashboard")}
            testID="paywall-maybe-later"
          >
            <Text style={styles.maybe}>Maybe Later</Text>
          </TouchableOpacity>
        </ScrollView>
        <Disclaimer />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(12,24,20,0.7)",
    marginBottom: 24,
  },
  crest: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(212,175,55,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.4)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 28,
  },
  overline: { color: colors.gold, fontSize: 11, letterSpacing: 3, fontWeight: "600", marginBottom: 12 },
  h1: { color: colors.textPrimary, fontSize: 42, lineHeight: 46, fontWeight: "300", marginBottom: 16 },
  lede: { color: colors.textSecondary, fontSize: 15, lineHeight: 24, marginBottom: 32, opacity: 0.85 },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 32,
  },
  priceAmount: { color: colors.textPrimary, fontSize: 48, fontWeight: "300" },
  pricePeriod: { color: colors.textMuted, fontSize: 16, marginBottom: 10 },
  perks: { marginBottom: 36, gap: 14 },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  perkDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(16,185,129,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderGlow,
  },
  perkText: { color: colors.textSecondary, fontSize: 14 },
  err: { color: colors.danger, fontSize: 13, marginBottom: 12 },
  cta: {
    backgroundColor: colors.gold,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
    marginBottom: 14,
    shadowColor: colors.gold,
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  ctaText: { color: "#000000", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  maybe: { color: colors.textMuted, fontSize: 14, textAlign: "center", paddingVertical: 8 },
});
