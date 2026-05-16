import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { apiFetch, useAuth } from "@/src/auth/AuthContext";
import { Disclaimer } from "@/src/components/Disclaimer";

const HEX = "https://static.prod-images.emergentagent.com/jobs/bd21e9a4-6942-4c32-837d-88bb0dd6eb09/images/e82e38ff1c401c380b7852bbfc240bab6af8a0a3f35924d0c58fd6ee73026e30.png";

export default function Dashboard() {
  const router = useRouter();
  const { user, token, logout, loading, refresh } = useAuth();
  const [readings, setReadings] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [rs, ps] = await Promise.all([
        apiFetch(token, "/readings"),
        apiFetch(token, "/birth-profiles"),
      ]);
      setReadings(rs || []);
      setProfiles(ps || []);
    } catch {}
    setLoadingData(false);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
      refresh();
    }, [load, refresh])
  );

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [loading, user, router]);

  const onAddPerson = () => {
    if (!user) return;
    if (profiles.length >= 1 && !user.is_premium) {
      router.push("/paywall");
    } else {
      router.push("/birth-input");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refresh()]);
    setRefreshing(false);
  };

  if (!user || loadingData) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} testID="dashboard-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.emerald}
          />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.overline}>WELCOME BACK</Text>
            <Text style={styles.greeting}>{user.name || user.email}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.iconBtn} testID="logout-btn">
            <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Subscription Card */}
        <View style={[styles.card, user.is_premium && styles.premiumCard]}>
          <View style={styles.cardTopRow}>
            <View>
              <Text style={styles.cardOverline}>
                {user.is_premium ? "PREMIUM MEMBER" : "FREE PLAN"}
              </Text>
              <Text style={styles.cardTitle}>
                {user.is_premium ? "All readings unlocked" : "1 personal reading"}
              </Text>
            </View>
            {user.is_premium ? (
              <View style={styles.badgeGold}>
                <Ionicons name="star" size={14} color={colors.gold} />
              </View>
            ) : (
              <Image source={{ uri: HEX }} style={{ width: 48, height: 48, opacity: 0.4 }} />
            )}
          </View>
          {!user.is_premium && (
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => router.push("/paywall")}
              testID="upgrade-btn"
            >
              <Text style={styles.upgradeText}>Upgrade to Premium</Text>
              <Ionicons name="arrow-forward" size={16} color="#04130E" />
            </TouchableOpacity>
          )}
        </View>

        {/* People */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Saved people</Text>
          <TouchableOpacity onPress={onAddPerson} testID="add-person-btn">
            <Text style={styles.linkText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {profiles.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={() => router.push("/birth-input")}
            testID="empty-add-cta"
          >
            <Ionicons name="add-circle-outline" size={28} color={colors.emerald} />
            <Text style={styles.emptyTitle}>Begin your first reading</Text>
            <Text style={styles.emptySub}>Enter birth details to receive your BaZi & I Ching guidance.</Text>
          </TouchableOpacity>
        ) : (
          profiles.map((p) => (
            <View key={p.profile_id} style={styles.personRow} testID={`person-${p.profile_id}`}>
              <View style={styles.personAvatar}>
                <Text style={styles.personInitial}>{(p.name || "?")[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{p.name}</Text>
                <Text style={styles.personMeta}>
                  {p.birth_year}-{String(p.birth_month).padStart(2, "0")}-
                  {String(p.birth_day).padStart(2, "0")} · {p.birthplace}
                </Text>
              </View>
            </View>
          ))
        )}

        {/* Readings */}
        <View style={[styles.sectionHeader, { marginTop: 32 }]}>
          <Text style={styles.sectionTitle}>Past readings</Text>
          {readings.length > 0 && (
            <Text style={styles.linkText}>{readings.length}</Text>
          )}
        </View>

        {readings.length === 0 ? (
          <Text style={styles.emptyText}>Your readings will appear here.</Text>
        ) : (
          readings.map((r) => (
            <TouchableOpacity
              key={r.reading_id}
              style={styles.readingRow}
              onPress={() => router.push(`/reading/${r.reading_id}`)}
              testID={`reading-${r.reading_id}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.readingName}>
                  {r.profile_snapshot?.name || "Reading"}
                </Text>
                <Text style={styles.readingDate}>
                  {new Date(r.created_at).toLocaleDateString()} · BaZi & I Ching
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))
        )}

        <Disclaimer />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },
  overline: { color: colors.emerald, fontSize: 10, letterSpacing: 2, fontWeight: "600" },
  greeting: { color: colors.textPrimary, fontSize: 28, fontWeight: "300", marginTop: 4 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: colors.bgSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    marginBottom: 24,
  },
  premiumCard: { borderColor: "rgba(212,175,55,0.4)" },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardOverline: { color: colors.textMuted, fontSize: 10, letterSpacing: 2, fontWeight: "600" },
  cardTitle: { color: colors.textPrimary, fontSize: 20, marginTop: 6, fontWeight: "400" },
  badgeGold: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(212,175,55,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  upgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.emerald,
    paddingVertical: 14,
    borderRadius: 999,
    marginTop: 18,
  },
  upgradeText: { color: "#04130E", fontWeight: "700", fontSize: 14 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "500" },
  linkText: { color: colors.emerald, fontSize: 13, fontWeight: "600" },
  emptyCard: {
    backgroundColor: colors.bgSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "500", marginTop: 4 },
  emptySub: { color: colors.textSecondary, fontSize: 13, textAlign: "center", opacity: 0.7 },
  emptyText: { color: colors.textMuted, fontSize: 13, opacity: 0.6 },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.bgSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  personAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(16,185,129,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderGlow,
  },
  personInitial: { color: colors.emerald, fontSize: 18, fontWeight: "600" },
  personName: { color: colors.textPrimary, fontSize: 15, fontWeight: "500" },
  personMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  readingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  readingName: { color: colors.textPrimary, fontSize: 15, fontWeight: "500" },
  readingDate: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
