import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { useAuth } from "@/src/auth/AuthContext";
import { Disclaimer } from "@/src/components/Disclaimer";

export default function AuthScreen() {
  const router = useRouter();
  const { login, signup, setGoogleSession, user } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  // Web: handle session_id in URL
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const checkUrl = async () => {
      try {
        const hash = (typeof window !== "undefined" && window.location.hash) || "";
        const search = (typeof window !== "undefined" && window.location.search) || "";
        let sid: string | null = null;
        if (hash.includes("session_id=")) {
          sid = new URLSearchParams(hash.replace(/^#/, "")).get("session_id");
        } else if (search.includes("session_id=")) {
          sid = new URLSearchParams(search).get("session_id");
        }
        if (sid) {
          setBusy(true);
          await setGoogleSession(sid);
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
      } catch (e: any) {
        setErr(e.message || "Google login failed");
      } finally {
        setBusy(false);
      }
    };
    checkUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async () => {
    setErr(null);
    if (!email || !password) {
      setErr("Email and password required");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") await signup(email.trim(), password, name.trim() || undefined);
      else await login(email.trim(), password);
    } catch (e: any) {
      setErr(e.message || "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setErr(null);
    try {
      if (Platform.OS === "web") {
        const redirect = (typeof window !== "undefined" ? window.location.origin : "") + "/auth";
        const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
        if (typeof window !== "undefined") window.location.href = authUrl;
      } else {
        const redirect = Linking.createURL("auth");
        const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
        if (result.type === "success" && result.url) {
          const parsed = Linking.parse(result.url);
          const sid = (parsed.queryParams?.session_id as string) || extractFromFragment(result.url);
          if (sid) {
            setBusy(true);
            await setGoogleSession(sid);
          }
        }
      }
    } catch (e: any) {
      setErr(e.message || "Google login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="auth-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            testID="auth-back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
          </TouchableOpacity>

          <Text style={styles.overline}>WELCOME</Text>
          <Text style={styles.h1}>
            {mode === "login" ? "Sign in" : "Begin\nyour reading"}
          </Text>
          <Text style={styles.sub}>
            {mode === "login"
              ? "Continue your journey of reflection."
              : "Create an account to save your readings."}
          </Text>

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={onGoogle}
            disabled={busy}
            testID="google-auth-btn"
          >
            <Ionicons name="logo-google" size={18} color={colors.textPrimary} />
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR EMAIL</Text>
            <View style={styles.dividerLine} />
          </View>

          {mode === "signup" && (
            <Input
              testID="auth-name"
              placeholder="Your name (optional)"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}
          <Input
            testID="auth-email"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            testID="auth-password"
            placeholder="Password (min 6 chars)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {err && (
            <Text style={styles.err} testID="auth-error">
              {err}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.submit, busy && { opacity: 0.6 }]}
            onPress={onSubmit}
            disabled={busy}
            testID="auth-submit"
          >
            {busy ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.submitText}>
                {mode === "login" ? "Sign in" : "Create account"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode(mode === "login" ? "signup" : "login")}
            testID="auth-toggle"
          >
            <Text style={styles.toggle}>
              {mode === "login"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
        <Disclaimer />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function extractFromFragment(url: string): string | null {
  const idx = url.indexOf("#");
  if (idx < 0) return null;
  const params = new URLSearchParams(url.slice(idx + 1));
  return params.get("session_id");
}

const Input: React.FC<any> = (props) => (
  <TextInput
    placeholderTextColor="rgba(212, 212, 212, 0.4)"
    style={styles.input}
    {...props}
  />
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
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
    color: colors.emerald,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "600",
    marginBottom: 12,
  },
  h1: {
    color: colors.textPrimary,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "300",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  sub: { color: colors.textSecondary, fontSize: 15, marginBottom: 32, opacity: 0.8 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
    marginBottom: 24,
  },
  googleText: { color: colors.textPrimary, fontSize: 15, fontWeight: "500" },
  divider: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 2,
    marginHorizontal: 12,
  },
  input: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: 18,
    color: colors.textPrimary,
    fontSize: 15,
    marginBottom: 12,
  },
  err: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
  },
  submit: {
    backgroundColor: colors.emerald,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  submitText: { color: "#000000", fontSize: 16, fontWeight: "700" },
  toggle: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
});
