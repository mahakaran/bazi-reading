import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { apiFetch, useAuth } from "@/src/auth/AuthContext";

export default function PaywallSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams<{ session_id?: string }>();
  const { token, refresh } = useAuth();
  const [status, setStatus] = useState<"checking" | "paid" | "failed">("checking");

  useEffect(() => {
    let cancel = false;
    const run = async () => {
      const sid = params.session_id;
      if (!sid || !token) {
        setStatus("failed");
        return;
      }
      for (let i = 0; i < 12 && !cancel; i++) {
        try {
          const s = await apiFetch(token, `/stripe/session/${sid}`);
          if (s.payment_status === "paid") {
            await refresh();
            if (!cancel) setStatus("paid");
            return;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancel) setStatus("failed");
    };
    run();
    return () => {
      cancel = true;
    };
  }, [params.session_id, token, refresh]);

  return (
    <SafeAreaView style={styles.root} testID="paywall-success-screen">
      <View style={styles.center}>
        {status === "checking" && (
          <>
            <ActivityIndicator color={colors.emerald} size="large" />
            <Text style={styles.text}>Confirming your subscription…</Text>
          </>
        )}
        {status === "paid" && (
          <>
            <View style={styles.iconWrap}>
              <Ionicons name="checkmark" size={36} color={colors.emerald} />
            </View>
            <Text style={styles.h1}>You're Premium</Text>
            <Text style={styles.sub}>Welcome to deeper readings.</Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.replace("/dashboard")}
              testID="success-continue"
            >
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}
        {status === "failed" && (
          <>
            <Text style={styles.h1}>Unable to confirm</Text>
            <Text style={styles.sub}>Please try again or contact support.</Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.replace("/dashboard")}
              testID="success-back"
            >
              <Text style={styles.btnText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(16,185,129,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderGlow,
  },
  text: { color: colors.textSecondary, fontSize: 15 },
  h1: { color: colors.textPrimary, fontSize: 28, fontWeight: "300" },
  sub: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
  btn: {
    backgroundColor: colors.emerald,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
    marginTop: 16,
  },
  btnText: { color: "#04130E", fontWeight: "700" },
});
