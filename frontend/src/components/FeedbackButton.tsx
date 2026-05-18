import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { apiFetch, useAuth } from "@/src/auth/AuthContext";

type Props = {
  context: "dashboard" | "reading";
  readingId?: string;
  compact?: boolean;
};

export const FeedbackButton: React.FC<Props> = ({ context, readingId, compact }) => {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setRating(0);
    setMessage("");
    setBusy(false);
    setDone(false);
    setErr(null);
  };

  const close = () => {
    setOpen(false);
    // Reset after close animation
    setTimeout(reset, 250);
  };

  const submit = async () => {
    setErr(null);
    if (rating < 1) {
      setErr("Please pick a rating");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(token, "/feedback", {
        method: "POST",
        body: JSON.stringify({
          rating,
          message: message.trim() || null,
          context,
          reading_id: readingId || null,
        }),
      });
      setDone(true);
      setTimeout(close, 1600);
    } catch (e: any) {
      setErr(e.message || "Failed to send feedback");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {compact ? (
        <TouchableOpacity
          style={styles.compactBtn}
          onPress={() => setOpen(true)}
          testID="feedback-btn-compact"
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.textMuted} />
          <Text style={styles.compactText}>Send feedback</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.cardBtn}
          onPress={() => setOpen(true)}
          testID="feedback-btn"
          activeOpacity={0.85}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.textPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>How is your reading?</Text>
            <Text style={styles.cardSub}>Share quick feedback — it helps us refine the experience.</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      )}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close} testID="feedback-backdrop">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.kav}
            pointerEvents="box-none"
          >
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.grabber} />
              {done ? (
                <View style={styles.doneWrap}>
                  <View style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={26} color={colors.textPrimary} />
                  </View>
                  <Text style={styles.doneTitle}>Thank you</Text>
                  <Text style={styles.doneSub}>Your feedback has been recorded.</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.title}>Share your feedback</Text>
                  <Text style={styles.subtitle}>
                    {context === "reading"
                      ? "How did this reading land for you?"
                      : "How is your experience so far?"}
                  </Text>

                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => setRating(n)}
                        testID={`star-${n}`}
                        style={styles.starBtn}
                      >
                        <Ionicons
                          name={rating >= n ? "star" : "star-outline"}
                          size={30}
                          color={rating >= n ? colors.gold : colors.textMuted}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    placeholder="What worked? What felt off? (optional)"
                    placeholderTextColor="rgba(212, 212, 212, 0.4)"
                    value={message}
                    onChangeText={setMessage}
                    style={styles.textarea}
                    multiline
                    numberOfLines={4}
                    maxLength={1000}
                    testID="feedback-message"
                  />

                  {err && (
                    <Text style={styles.err} testID="feedback-error">
                      {err}
                    </Text>
                  )}

                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={close}
                      style={styles.cancelBtn}
                      testID="feedback-cancel"
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={submit}
                      style={[styles.submitBtn, busy && { opacity: 0.6 }]}
                      disabled={busy}
                      testID="feedback-submit"
                    >
                      {busy ? (
                        <ActivityIndicator color="#000000" />
                      ) : (
                        <Text style={styles.submitText}>Send</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // Full card variant (Dashboard)
  cardBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.bgSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "500" },
  cardSub: { color: colors.textMuted, fontSize: 12, marginTop: 3 },

  // Compact pill variant (Reading screen)
  compactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: "center",
    marginTop: 12,
  },
  compactText: { color: colors.textMuted, fontSize: 12, fontWeight: "500" },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  kav: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: "400", marginBottom: 6 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginBottom: 24 },
  starsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  starBtn: { padding: 4 },
  textarea: {
    minHeight: 100,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 14,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  err: { color: colors.danger, fontSize: 13, marginBottom: 8 },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  cancelText: { color: colors.textMuted, fontSize: 14, fontWeight: "500" },
  submitBtn: {
    flex: 1.4,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.textPrimary,
    alignItems: "center",
  },
  submitText: { color: "#000000", fontSize: 14, fontWeight: "700" },

  // Thank-you state
  doneWrap: { alignItems: "center", paddingVertical: 20, gap: 10 },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  doneTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "400" },
  doneSub: { color: colors.textMuted, fontSize: 14 },
});
