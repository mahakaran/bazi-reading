import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { colors } from "@/src/theme";
import { Disclaimer } from "@/src/components/Disclaimer";
import { useAuth } from "@/src/auth/AuthContext";

const HERO = "https://static.prod-images.emergentagent.com/jobs/bd21e9a4-6942-4c32-837d-88bb0dd6eb09/images/5f0ad2d1f3ddacdef166948fbc8d45a0cbfcbe4617646a73aa2e9e479baf9a23.png";
const HEX = "https://static.prod-images.emergentagent.com/jobs/bd21e9a4-6942-4c32-837d-88bb0dd6eb09/images/e82e38ff1c401c380b7852bbfc240bab6af8a0a3f35924d0c58fd6ee73026e30.png";

export default function Landing() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const onCTA = () => {
    if (user) router.replace("/dashboard");
    else router.push("/auth");
  };

  return (
    <View style={styles.root} testID="landing-screen">
      <ScrollView contentContainerStyle={styles.scroll}>
        <ImageBackground source={{ uri: HERO }} style={styles.hero} resizeMode="cover">
          <LinearGradient
            colors={["rgba(4,9,7,0.3)", "rgba(4,9,7,0.85)", colors.bg]}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView style={styles.heroInner}>
            <View style={styles.brandRow}>
              <View style={styles.dot} />
              <Text style={styles.brandText}>BaZi · I Ching</Text>
            </View>
          </SafeAreaView>
        </ImageBackground>

        <View style={styles.content}>
          <Text style={styles.overline}>ANCIENT WISDOM · MODERN REFLECTION</Text>
          <Text style={styles.h1}>Your destiny,{"\n"}illuminated.</Text>
          <Text style={styles.lede}>
            A personalised BaZi & I Ching reading shaped by the moment you were born.
            Reflective, symbolic guidance — never deterministic.
          </Text>

          <View style={styles.featuresRow}>
            <Feature label="Five Elements" />
            <Feature label="I Ching" />
            <Feature label="Life Phase" />
          </View>

          <TouchableOpacity
            style={styles.cta}
            onPress={onCTA}
            disabled={loading}
            testID="get-reading-cta"
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Get Your Reading</Text>
          </TouchableOpacity>

          {!user && (
            <TouchableOpacity onPress={() => router.push("/auth")} testID="landing-login-link">
              <Text style={styles.secondary}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          )}

          <View style={styles.hexWrap}>
            <Image source={{ uri: HEX }} style={styles.hexImg} resizeMode="contain" />
            <Text style={styles.quote}>
              "The wise person reads the patterns, but never confuses them for fate."
            </Text>
          </View>
        </View>
        <Disclaimer />
      </ScrollView>
    </View>
  );
}

const Feature: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.featChip}>
    <Text style={styles.featTxt}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 24 },
  hero: { height: 380, justifyContent: "flex-start" },
  heroInner: { paddingHorizontal: 24, paddingTop: 8 },
  brandRow: { flexDirection: "row", alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emerald, marginRight: 10 },
  brandText: {
    color: colors.textSecondary,
    fontSize: 12,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  content: { paddingHorizontal: 24, marginTop: -32 },
  overline: {
    color: colors.emerald,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "600",
    marginBottom: 16,
  },
  h1: {
    color: colors.textPrimary,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: "300",
    fontFamily: "serif",
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  lede: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 28,
    opacity: 0.85,
  },
  featuresRow: { flexDirection: "row", gap: 8, marginBottom: 32, flexWrap: "wrap" },
  featChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
  featTxt: { color: colors.textMuted, fontSize: 12, letterSpacing: 1 },
  cta: {
    backgroundColor: colors.emerald,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: colors.emerald,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  ctaText: { color: "#04130E", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  secondary: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  hexWrap: { alignItems: "center", marginTop: 32, paddingHorizontal: 24 },
  hexImg: { width: 100, height: 100, opacity: 0.5, marginBottom: 16 },
  quote: {
    color: colors.textDim,
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 22,
  },
});
