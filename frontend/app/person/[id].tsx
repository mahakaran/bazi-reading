import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { apiFetch, useAuth } from "@/src/auth/AuthContext";
import { Disclaimer } from "@/src/components/Disclaimer";

export default function PersonDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [birthplace, setBirthplace] = useState("");
  const [gender, setGender] = useState("");

  useEffect(() => {
    if (!id || !token) return;
    (async () => {
      try {
        const list = await apiFetch(token, "/birth-profiles");
        const p = (list || []).find((x: any) => x.profile_id === id);
        if (p) {
          setProfile(p);
          setName(p.name || "");
          setYear(String(p.birth_year || ""));
          setMonth(String(p.birth_month || ""));
          setDay(String(p.birth_day || ""));
          setHour(String(p.birth_hour ?? ""));
          setMinute(String(p.birth_minute ?? ""));
          setBirthplace(p.birthplace || "");
          setGender(p.gender || "");
        }
      } catch (e: any) {
        setErr(e.message || "Failed to load");
      }
    })();
  }, [id, token]);

  const onSave = async () => {
    setErr(null);
    setBusy(true);
    try {
      await apiFetch(token, `/birth-profiles/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          birth_year: parseInt(year, 10),
          birth_month: parseInt(month, 10),
          birth_day: parseInt(day, 10),
          birth_hour: parseInt(hour, 10),
          birth_minute: parseInt(minute, 10),
          birthplace: birthplace.trim(),
          gender: gender || null,
        }),
      });
      router.replace("/dashboard");
    } catch (e: any) {
      setErr(e.message || "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (Platform.OS === "web") {
      const ok =
        typeof window !== "undefined"
          ? window.confirm(`Delete ${profile?.name}? Their readings will also be removed.`)
          : true;
      if (ok) doDelete();
      return;
    }
    Alert.alert(
      "Delete person",
      `Remove ${profile?.name} and their readings?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]
    );
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await apiFetch(token, `/birth-profiles/${id}`, { method: "DELETE" });
      router.replace("/dashboard");
    } catch (e: any) {
      setErr(e.message || "Failed to delete");
      setBusy(false);
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.emerald} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} testID="person-detail-screen">
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
            testID="person-back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
          </TouchableOpacity>

          <Text style={styles.overline}>EDIT PERSON</Text>
          <Text style={styles.h1}>{profile.name}</Text>

          <Field label="Name">
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              testID="edit-name"
              placeholderTextColor="rgba(167, 243, 208, 0.4)"
            />
          </Field>
          <Field label="Date of Birth">
            <View style={styles.row3}>
              <TextInput
                value={year}
                onChangeText={setYear}
                style={[styles.input, styles.flex2]}
                keyboardType="number-pad"
                maxLength={4}
                testID="edit-year"
              />
              <TextInput
                value={month}
                onChangeText={setMonth}
                style={[styles.input, styles.flex1]}
                keyboardType="number-pad"
                maxLength={2}
                testID="edit-month"
              />
              <TextInput
                value={day}
                onChangeText={setDay}
                style={[styles.input, styles.flex1]}
                keyboardType="number-pad"
                maxLength={2}
                testID="edit-day"
              />
            </View>
          </Field>
          <Field label="Time">
            <View style={styles.row3}>
              <TextInput
                value={hour}
                onChangeText={setHour}
                style={[styles.input, styles.flex1]}
                keyboardType="number-pad"
                maxLength={2}
                testID="edit-hour"
              />
              <TextInput
                value={minute}
                onChangeText={setMinute}
                style={[styles.input, styles.flex1]}
                keyboardType="number-pad"
                maxLength={2}
                testID="edit-minute"
              />
            </View>
          </Field>
          <Field label="Birthplace">
            <TextInput
              value={birthplace}
              onChangeText={setBirthplace}
              style={styles.input}
              testID="edit-birthplace"
              placeholderTextColor="rgba(167, 243, 208, 0.4)"
            />
          </Field>

          {err && (
            <Text style={styles.err} testID="edit-error">
              {err}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, busy && { opacity: 0.6 }]}
            onPress={onSave}
            disabled={busy}
            testID="edit-save"
          >
            {busy ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.saveText}>Save changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={confirmDelete}
            disabled={busy}
            testID="edit-delete"
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.deleteText}>Delete person</Text>
          </TouchableOpacity>

          <Disclaimer />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
);

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
  overline: { color: colors.emerald, fontSize: 11, letterSpacing: 3, fontWeight: "600", marginBottom: 12 },
  h1: { color: colors.textPrimary, fontSize: 32, fontWeight: "300", marginBottom: 24 },
  field: { marginBottom: 20 },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
    marginBottom: 10,
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
  },
  row3: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
  flex2: { flex: 1.6 },
  err: { color: colors.danger, fontSize: 13, marginBottom: 12 },
  saveBtn: {
    backgroundColor: colors.emerald,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  saveText: { color: "#000000", fontWeight: "700", fontSize: 15 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    marginBottom: 8,
  },
  deleteText: { color: colors.danger, fontSize: 14, fontWeight: "500" },
});
