import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { colors } from "@/src/theme";

export const Disclaimer: React.FC<{ style?: any }> = ({ style }) => (
  <View style={[styles.wrap, style]} testID="footer-disclaimer">
    <Text style={styles.text}>For reflection and entertainment only. Not professional advice.</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: { paddingVertical: 16, paddingHorizontal: 24 },
  text: {
    color: "rgba(167, 243, 208, 0.45)",
    fontSize: 11,
    textAlign: "center",
    letterSpacing: 0.3,
  },
});
