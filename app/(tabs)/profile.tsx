import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Heading, Card } from "../../src/components/UI";
import { theme } from "../../src/theme";
export default function Profile() {
  return (
    <View style={s.page}>
      <Heading sub="Your Fraggy membership">Profile</Heading>
      <Card>
        <Text style={s.title}>Free plan</Text>
        <Text style={s.text}>1 default shelf · Up to 7 perfumes</Text>
        <Text style={s.note}>
          Subscription purchase is not enabled in this prototype.
        </Text>
      </Card>
    </View>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, padding: 24, paddingTop: 70, backgroundColor: theme.bg },
  title: { fontSize: 19, fontWeight: "700", color: theme.ink },
  text: { marginTop: 8, color: theme.muted },
  note: { marginTop: 18, color: theme.accent, fontSize: 12 },
});
