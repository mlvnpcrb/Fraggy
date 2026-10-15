import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Heading, Card } from "../../src/components/UI";
import { theme } from "../../src/theme";
export default function Trades() {
  return (
    <View style={s.page}>
      <Heading sub="Offers and counteroffers will appear here">
        Trade requests
      </Heading>
      <Card>
        <Text style={s.text}>
          No live trade requests yet. This screen will connect to Supabase after
          authentication and row-level security are configured.
        </Text>
      </Card>
    </View>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, padding: 24, paddingTop: 70, backgroundColor: theme.bg },
  text: { lineHeight: 22, color: theme.muted },
});
