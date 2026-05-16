import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { apiFetch, useAuth } from "@/src/auth/AuthContext";
import { Disclaimer } from "@/src/components/Disclaimer";

export default function BirthInput() {
  const router = useRouter();
  const { token, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [birthplace, setBirthplace] = useState("");
  const [gender, setGender] = useState<string>("");

  const validate = (): string | null => {
    if (!name.trim()) return "Please enter a name";
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    const h = parseInt(hour, 10);
    const min = parseInt(minute, 10);
    if (!y || y < 1900 || y > 2100) return "Year must be between 1900–2100";
    if (!m || m < 1 || m > 12) return "Month must be 1–12";
    if (!d || d < 1 || d > 31) return "Day must be 1–31";
    if (isNaN(h) || h < 0 || h > 23) return "Hour must be 0–23";
    if (isNaN(min) || min < 0 || min > 59) return "Minute must be 0–59";
    if (!birthplace.trim()) return "Please enter a birthplace";
    return null;
  };

  const onSubmit = async () => {
    setErr(null);
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    setBusy(true);
    try {
      const profile = await apiFetch(token, "/birth-profiles", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          birth_year: parseInt(year, 10),
          birth_month: parseInt(month, 10),
          birth_day: parseInt(day, 10),
          birth_hour: parseInt(hour, 10),
          birth_minute: parseInt(minute, 10),
          birthplace: birthplace.trim(),
          gender: gender || undefined,
        }),
      });
      // Generate reading
      const reading = await apiFetch(token, `/readings/generate/${profile.profile_id}`, {
        method: "POST",
      });
      await refresh();
      router.replace(`/reading/${reading.reading_id}`);
    } catch (e: any) {
      if (e.status === 402) {
        router.replace("/paywall");
        return;
      }
      setErr(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="birth-input-screen">
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
            testID="birth-back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
          </TouchableOpacity>

          <Text style={styles.overline}>THE BEGINNING</Text>
          <Text style={styles.h1}>Your birth{"\n"}moment</Text>
          <Text style={styles.sub}>
            Every detail shapes the energetic pattern. Be as precise as you can.
          </Text>

          <Field label="Name / Nickname">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g., Lin"
              placeholderTextColor="rgba(167, 243, 208, 0.4)"
              style={styles.input}
              autoCapitalize="words"
              testID="bp-name"
            />
          </Field>

          <Field label="Date of Birth">
            <View style={styles.row3}>
              <TextInput
                value={year}
                onChangeText={setYear}
                placeholder="YYYY"
                placeholderTextColor="rgba(167, 243, 208, 0.4)"
                style={[styles.input, styles.flex2]}
                keyboardType="number-pad"
                maxLength={4}
                testID="bp-year"
              />
              <TextInput
                value={month}
                onChangeText={setMonth}
                placeholder="MM"
                placeholderTextColor="rgba(167, 243, 208, 0.4)"
                style={[styles.input, styles.flex1]}
                keyboardType="number-pad"
                maxLength={2}
                testID="bp-month"
              />
              <TextInput
                value={day}
                onChangeText={setDay}
                placeholder="DD"
                placeholderTextColor="rgba(167, 243, 208, 0.4)"
                style={[styles.input, styles.flex1]}
                keyboardType="number-pad"
                maxLength={2}
                testID="bp-day"
              />
            </View>
          </Field>

          <Field label="Time of Birth (24h)">
            <View style={styles.row2}>
              <TextInput
                value={hour}
                onChangeText={setHour}
                placeholder="HH"
                placeholderTextColor="rgba(167, 243, 208, 0.4)"
                style={[styles.input, styles.flex1]}
                keyboardType="number-pad"
                maxLength={2}
                testID="bp-hour"
              />
              <TextInput
                value={minute}
                onChangeText={setMinute}
                placeholder="MM"
                placeholderTextColor="rgba(167, 243, 208, 0.4)"
                style={[styles.input, styles.flex1]}
                keyboardType="number-pad"
                maxLength={2}
                testID="bp-minute"
              />
            </View>
          </Field>

          <Field label="Birthplace">
            <TextInput
              value={birthplace}
              onChangeText={setBirthplace}
              placeholder="City, Country"
              placeholderTextColor="rgba(167, 243, 208, 0.4)"
              style={styles.input}
              testID="bp-place"
            />
          </Field>

          <Field label="Gender (optional)">
            <View style={styles.genderRow}>
              {["Female", "Male", "Other", "Prefer not"].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderChip, gender === g && styles.genderChipActive]}
                  onPress={() => setGender(gender === g ? "" : g)}
                  testID={`bp-gender-${g}`}
                >
                  <Text
                    style={[styles.genderText, gender === g && styles.genderTextActive]}
                  >
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          {err && (
            <Text style={styles.err} testID="bp-error">
              {err}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.submit, busy && { opacity: 0.6 }]}
            onPress={onSubmit}
            disabled={busy}
            testID="bp-submit"
          >
            {busy ? (
              <View style={styles.busyRow}>
                <ActivityIndicator color="#04130E" />
                <Text style={styles.submitText}>  Reading the elements…</Text>
              </View>
            ) : (
              <Text style={styles.submitText}>Generate Reading</Text>
            )}
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
  h1: { color: colors.textPrimary, fontSize: 38, lineHeight: 44, fontWeight: "300", marginBottom: 12 },
  sub: { color: colors.textSecondary, fontSize: 15, marginBottom: 28, opacity: 0.85, lineHeight: 22 },
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
  row2: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
  flex2: { flex: 1.6 },
  genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genderChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
  genderChipActive: { borderColor: colors.emerald, backgroundColor: "rgba(16,185,129,0.12)" },
  genderText: { color: colors.textMuted, fontSize: 13 },
  genderTextActive: { color: colors.emerald, fontWeight: "600" },
  err: { color: colors.danger, fontSize: 13, marginBottom: 12 },
  submit: {
    backgroundColor: colors.emerald,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
    shadowColor: colors.emerald,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  busyRow: { flexDirection: "row", alignItems: "center" },
  submitText: { color: "#04130E", fontSize: 16, fontWeight: "700" },
});
