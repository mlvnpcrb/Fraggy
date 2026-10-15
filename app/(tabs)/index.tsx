import React from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Heading, Card, Action } from "../../src/components/UI";
import { demoPerfumes, FREE_LIMIT } from "../../src/data/demo";
import { theme } from "../../src/theme";
export default function Shelf() {
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={s.logo}>fraggy.</Text>
      <Heading
        sub={`${demoPerfumes.length} of ${FREE_LIMIT} perfumes · Free plan`}
      >
        Your fragrance wardrobe
      </Heading>
      <Action title="+ Add perfume" onPress={() => router.push("/add")} />
      <Text style={s.section}>My collection</Text>
      {demoPerfumes.map((p) => (
        <Card key={p.id}>
          <Text style={s.brand}>{p.brand}</Text>
          <Text style={s.name}>{p.name}</Text>
          <Text style={s.info}>
            {p.kind} · {p.remainingMl}/{p.sizeMl} ml{" "}
            {p.trade ? "· Available for trade" : ""}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { padding: 24, paddingTop: 65, backgroundColor: theme.bg, flexGrow: 1 },
  logo: { fontSize: 30, fontWeight: "900", color: theme.ink, marginBottom: 32 },
  section: {
    fontSize: 21,
    fontWeight: "700",
    marginTop: 32,
    marginBottom: 16,
    color: theme.ink,
  },
  brand: { color: theme.muted, fontSize: 12 },
  name: { fontSize: 19, fontWeight: "700", color: theme.ink, marginTop: 4 },
  info: { fontSize: 12, color: theme.accent, marginTop: 10 },
});
