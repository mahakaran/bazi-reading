import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const API = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
const ADMIN_KEY_STORAGE = "admin_key_v1";

type FeedbackItem = {
  feedback_id: string;
  user_id: string;
  email?: string;
  name?: string;
  rating: number;
  message: string;
  context?: string;
  reading_id?: string;
  created_at: string;
};

type FeedbackResp = {
  summary: { count: number; avg_rating: number | null };
  items: FeedbackItem[];
};

export default function AdminFeedback() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [data, setData] = useState<FeedbackResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);

  const fetchAll = useCallback(
    async (adminKey: string) => {
      setErr(null);
      setLoading(true);
      try {
        const res = await fetch(`${API}/feedback/all`, {
          headers: { "X-Admin-Key": adminKey },
        });
        if (res.status === 401) {
          setErr("Invalid admin key");
          setAuthed(false);
          await storage.removeItem(ADMIN_KEY_STORAGE);
          return;
        }
        if (!res.ok) {
          setErr(`HTTP ${res.status}`);
          return;
        }
        const json: FeedbackResp = await res.json();
        setData(json);
        setAuthed(true);
        await storage.setItem(ADMIN_KEY_STORAGE, adminKey);
      } catch (e: any) {
        setErr(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem(ADMIN_KEY_STORAGE, "");
      if (saved) {
        setKey(saved);
        await fetchAll(saved);
      }
    })();
  }, [fetchAll]);

  const onSubmit = async () => {
    if (!key.trim()) return;
    await fetchAll(key.trim());
  };

  const onRefresh = async () => {
    if (!authed) return;
    setRefreshing(true);
    await fetchAll(key);
    setRefreshing(false);
  };

  const signOut = async () => {
    await storage.removeItem(ADMIN_KEY_STORAGE);
    setKey("");
    setData(null);
    setAuthed(false);
  };

  if (!authed) {
    return (
      <SafeAreaView style={styles.root} testID="admin-feedback-login">
        <View style={styles.center}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace("/")}
            testID="admin-back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={28} color={colors.textPrimary} />
          </View>
          <Text style={styles.title}>Admin Feedback</Text>
          <Text style={styles.subtitle}>Enter the admin key to view beta feedback.</Text>
          <TextInput
            value={key}
            onChangeText={setKey}
            placeholder="Admin key"
            placeholderTextColor="rgba(212, 212, 212, 0.4)"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={Platform.OS !== "web"}
            onSubmitEditing={onSubmit}
            testID="admin-key-input"
          />
          {err && <Text style={styles.err}>{err}</Text>}
          <TouchableOpacity
            style={[styles.cta, loading && { opacity: 0.6 }]}
            onPress={onSubmit}
            disabled={loading}
            testID="admin-key-submit"
          >
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.ctaText}>Unlock</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} testID="admin-feedback-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.replace("/")}
            style={styles.iconBtn}
            testID="admin-home"
          >
            <Ionicons name="home-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Beta Feedback</Text>
          <TouchableOpacity onPress={signOut} style={styles.iconBtn} testID="admin-signout">
            <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <Stat label="Total" value={data?.summary.count ?? 0} />
          <Stat
            label="Avg rating"
            value={data?.summary.avg_rating != null ? `${data.summary.avg_rating} ★` : "—"}
          />
        </View>

        {/* Items */}
        <Text style={styles.sectionTitle}>All submissions</Text>

        {!data || data.items.length === 0 ? (
          <Text style={styles.emptyText}>No feedback yet.</Text>
        ) : (
          data.items.map((it) => (
            <View key={it.feedback_id} style={styles.card} testID={`fb-${it.feedback_id}`}>
              <View style={styles.cardTop}>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons
                      key={n}
                      name={it.rating >= n ? "star" : "star-outline"}
                      size={14}
                      color={it.rating >= n ? colors.gold : colors.textMuted}
                      style={{ marginRight: 2 }}
                    />
                  ))}
                </View>
                <Text style={styles.timestamp}>
                  {new Date(it.created_at).toLocaleString()}
                </Text>
              </View>
              {!!it.message && <Text style={styles.message}>{it.message}</Text>}
              <View style={styles.meta}>
                <Text style={styles.metaText}>
                  {it.name || "Anon"} · {it.email || "—"}
                </Text>
                {it.context && (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{it.context}</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Stat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <View style={styles.stat}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  backBtn: {
    position: "absolute",
    top: 24,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  lockIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: "300", marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginBottom: 24, textAlign: "center" },
  input: {
    width: "100%",
    maxWidth: 380,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: 18,
    color: colors.textPrimary,
    fontSize: 14,
    marginBottom: 12,
  },
  err: { color: colors.danger, fontSize: 13, marginBottom: 8 },
  cta: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.textPrimary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
  },
  ctaText: { color: "#000000", fontSize: 15, fontWeight: "700" },

  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "500" },

  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
  stat: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  statLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 2, fontWeight: "600", textTransform: "uppercase" },
  statValue: { color: colors.textPrimary, fontSize: 26, fontWeight: "300", marginTop: 6 },

  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "500", marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 13, opacity: 0.7 },

  card: {
    backgroundColor: colors.bgSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  starsRow: { flexDirection: "row" },
  timestamp: { color: colors.textMuted, fontSize: 11 },
  message: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 10 },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metaText: { color: colors.textMuted, fontSize: 12, flex: 1 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: { color: colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" },
});
