import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { colors } from "@/src/theme";
import { Disclaimer } from "@/src/components/Disclaimer";
import { useAuth } from "@/src/auth/AuthContext";

const HERO =
  "https://images.unsplash.com/photo-1505506874110-6a7a69069a08?auto=format&fit=crop&w=1600&q=80";

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
          <View style={styles.heroOverlay} />
          <LinearGradient
            colors={["rgba(7,7,7,0.4)", "rgba(7,7,7,0.85)", colors.bg]}
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
          <Text style={styles.overline}>ANCIENT SYSTEMS · MODERN SELF-UNDERSTANDING</Text>
          <Text style={styles.h1}>
            Understand your patterns,{"\n"}
            <Text style={styles.h1Italic}>not your fate.</Text>
          </Text>
          <Text style={styles.lede}>
            A personalised BaZi and I Ching-inspired reading based on your birth date and time.
          </Text>
          <Text style={styles.support}>
            Explore your elemental balance, personality patterns, life themes, and relationship
            dynamics — presented as reflective guidance, not fixed predictions.
          </Text>

          <View style={styles.featuresRow}>
            <Feature label="Elemental Profile" />
            <Feature label="Life Patterns" />
            <Feature label="Reflective Guidance" />
          </View>

          <TouchableOpacity
            style={styles.cta}
            onPress={onCTA}
            disabled={loading}
            testID="get-reading-cta"
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Start Your Reading</Text>
          </TouchableOpacity>

          {!user && (
            <TouchableOpacity
              onPress={() => router.push("/auth")}
              testID="landing-login-link"
            >
              <Text style={styles.secondary}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          )}

          <View style={styles.quoteWrap}>
            <View style={styles.quoteLine} />
            <Text style={styles.quote}>
              &ldquo;Ancient wisdom to connect back to your essence.&rdquo;
            </Text>
            <View style={styles.quoteLine} />
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
  hero: { height: 420, justifyContent: "flex-start" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  heroInner: { paddingHorizontal: 24, paddingTop: 8 },
  brandRow: { flexDirection: "row", alignItems: "center" },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textPrimary,
    marginRight: 12,
  },
  brandText: {
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: 4,
    textTransform: "uppercase",
    fontWeight: "500",
  },
  content: { paddingHorizontal: 24, marginTop: -48 },
  overline: {
    color: colors.textMuted,
    fontSize: 10.5,
    letterSpacing: 2.8,
    fontWeight: "600",
    marginBottom: 22,
  },
  h1: {
    color: colors.textPrimary,
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "300",
    marginBottom: 20,
    letterSpacing: -0.8,
  },
  h1Italic: { fontStyle: "italic", fontWeight: "300", color: colors.textPrimary },
  lede: {
    color: colors.textSecondary,
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 14,
    fontWeight: "400",
  },
  support: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 23,
    marginBottom: 32,
  },
  featuresRow: { flexDirection: "row", gap: 8, marginBottom: 36, flexWrap: "wrap" },
  featChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
  featTxt: {
    color: colors.textSecondary,
    fontSize: 12,
    letterSpacing: 0.8,
    fontWeight: "500",
  },
  cta: {
    backgroundColor: colors.textPrimary,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
    marginBottom: 18,
  },
  ctaText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  secondary: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  quoteWrap: {
    alignItems: "center",
    marginTop: 40,
    paddingHorizontal: 8,
    gap: 16,
  },
  quoteLine: {
    width: 32,
    height: 1,
    backgroundColor: colors.border,
  },
  quote: {
    color: colors.textDim,
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
    letterSpacing: 0.2,
  },
});
