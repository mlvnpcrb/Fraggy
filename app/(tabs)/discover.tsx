import React from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import { Heading, Card } from "../../src/components/UI";
import { demoPerfumes } from "../../src/data/demo";
import { theme } from "../../src/theme";
export default function Discover() {
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Heading sub="Browse sample fragrance listings">Discover trades</Heading>
      {demoPerfumes
        .filter((p) => p.trade)
        .map((p) => (
          <Card key={p.id}>
            <Text style={s.name}>
              {p.brand} · {p.name}
            </Text>
            <Text style={s.meta}>
              {p.kind} · {p.remainingMl} ml remaining
            </Text>
            <Text style={s.note}>
              Demo listing · Trade actions coming with Supabase
            </Text>
          </Card>
        ))}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { padding: 24, paddingTop: 70, backgroundColor: theme.bg, flexGrow: 1 },
  name: { fontSize: 18, fontWeight: "700", color: theme.ink },
  meta: { marginTop: 8, color: theme.muted },
  note: { marginTop: 12, color: theme.accent, fontSize: 12 },
});
