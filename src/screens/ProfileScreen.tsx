import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { ui } from "../components/ui";
import { useDemo } from "../state/DemoProvider";
import { colors, fonts } from "../theme";
export function ProfileScreen() {
  const { reset, bottles, trades } = useDemo();
  const [confirm, setConfirm] = React.useState(false);
  return (
    <Screen>
      <View style={[ui.pad, { paddingTop: 26, gap: 22 }]}>
        <Text style={ui.eyebrow}>YOUR CORNER</Text>
        <Text style={ui.title}>A nose for{`\n`}good things.</Text>
        <View style={s.avatar}>
          <Text
            style={{ fontFamily: fonts.bold, color: colors.lime, fontSize: 30 }}
          >
            YOU
          </Text>
        </View>
        <Text style={ui.section}>The collector</Text>
        <Text style={ui.body}>Manila · Exploring the scent scene</Text>
        <View style={[ui.card, ui.row]}>
          <View>
            <Text style={ui.section}>
              {bottles.filter((b) => b.ownerId === "you").length}
            </Text>
            <Text style={ui.small}>On your shelf</Text>
          </View>
          <View>
            <Text style={ui.section}>
              {trades.filter((t) => t.status === "complete").length}
            </Text>
            <Text style={ui.small}>Swaps completed</Text>
          </View>
          <Feather name="arrow-up-right" size={28} color={colors.green} />
        </View>
        <View style={ui.card}>
          <Text style={ui.name}>Made for a test drive.</Text>
          <Text style={[ui.body, { marginTop: 10 }]}>
            This is Fraggy’s local prototype. Collectors, chat, and delivery
            details are samples. Background removal sends your photo to the
            processor on your computer without saving the upload there. Your
            session resets when the app restarts.
          </Text>
        </View>
        {confirm ? (
          <View style={{ gap: 12 }}>
            <Text style={ui.body}>
              Reset your sample shelf and trades? Added photos will leave this
              demo.
            </Text>
            <Button
              title="Yes, reset demo"
              onPress={() => {
                reset();
                setConfirm(false);
              }}
            />
            <Button
              title="Keep exploring"
              variant="outline"
              onPress={() => setConfirm(false)}
            />
          </View>
        ) : (
          <Button
            title="Reset demo collection"
            variant="outline"
            onPress={() => setConfirm(true)}
          />
        )}
        <Text style={[ui.eyebrow, { textAlign: "center", marginTop: 15 }]}>
          fraggy. / good scents, better swaps.
        </Text>
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
});
