import React, { useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { Bottle } from "../components/Bottle";
import { Button } from "../components/Button";
import { BackHeader, ui } from "../components/ui";
import { colors, fonts } from "../theme";
import { useDemo } from "../state/DemoProvider";
import { createDemo } from "../data/demo";
import type { ScreenProps } from "../navigation";
export function AddBottleScreen({ navigation }: ScreenProps<"AddBottle">) {
  const { addBottle } = useDemo();
  const [uri, setUri] = useState<string>();
  const [sample, setSample] = useState(false);
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [size, setSize] = useState("100");
  const [remaining, setRemaining] = useState("80");
  const [open, setOpen] = useState(true);
  const [error, setError] = useState("");
  const [permission, setPermission] = useState(false);
  const [busy, setBusy] = useState(false);
  const pick = async (camera: boolean) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setPermission(false);
    try {
      if (camera) {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) {
          setPermission(true);
          setError(
            "Camera access is off. Allow it in Settings, or choose a photo instead.",
          );
          return;
        }
      }
      if (!camera && Platform.OS !== "web") {
        const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!p.granted) {
          setPermission(true);
          setError(
            "Photo access is off. Allow access in Settings, or use the sample cutout.",
          );
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.85,
        allowsEditing: false,
      };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) {
        setUri(result.assets[0].uri);
        setSample(false);
      }
    } catch {
      setError(
        "Could not open your photos. Please try again or use the sample cutout.",
      );
    } finally {
      setBusy(false);
    }
  };
  const sampleBottle = createDemo().bottles[0];
  const image = uri || sample;
  const save = () => {
    try {
      if (!image) throw Error("Choose a photo or try the sample cutout first.");
      if (!size.trim() || !remaining.trim())
        throw Error("Enter the bottle size and remaining amount.");
      addBottle({
        brand,
        name,
        sizeMl: Number(size),
        remainingPercent: Number(remaining),
        imageKind: sample ? "sample-cutout" : "original",
        imageUri: sample ? undefined : uri,
        art: "amber",
        tradeAvailable: open,
        notes: "Your personal collection",
        methods: ["local", "shipping"],
      });
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add this bottle.");
    }
  };
  return (
    <Screen>
      <BackHeader
        title="MAKE SOME SHELF SPACE"
        onBack={() => navigation.goBack()}
      />
      <View style={[ui.pad, { gap: 17 }]}>
        <Text accessibilityRole="header" style={ui.title}>
          Shelf-worthy.
        </Text>
        <Text style={ui.body}>
          Photo first. Your next favorite, front and center.
        </Text>
        <View style={s.preview}>
          {image ? (
            <>
              <Bottle
                bottle={{ ...sampleBottle, imageUri: sample ? undefined : uri }}
                size={230}
              />
              <View style={s.badge}>
                <Text style={s.badgeText}>
                  {sample ? "SAMPLE CUTOUT · DEMO" : "YOUR ORIGINAL PHOTO"}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Feather name="camera" size={38} color={colors.green} />
              <Text style={[ui.name, { marginTop: 16 }]}>
                Give your bottle a moment.
              </Text>
              <Text style={[ui.small, { marginTop: 8 }]}>
                Choose a photo or take a fresh one.
              </Text>
            </>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button
            style={{ flex: 1 }}
            title={busy ? "Opening…" : "Choose photo"}
            disabled={busy}
            onPress={() => {
              void pick(false);
            }}
          />
          <Button
            style={{ flex: 1 }}
            title="Camera"
            variant="outline"
            disabled={busy}
            onPress={() => {
              void pick(true);
            }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setSample(true);
            setUri(undefined);
            setBrand("Le Labo");
            setName("Santal 33");
            setError("");
          }}
          style={{ paddingVertical: 12, minHeight: 44 }}
        >
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 13,
              color: colors.green,
              textAlign: "center",
            }}
          >
            Try a sample cutout instead ↗
          </Text>
        </Pressable>
        <Text style={ui.small}>
          {sample
            ? "This illustrated cutout previews the future background-removal experience."
            : "Your photo stays on this device. Automatic background removal is coming later."}
        </Text>
        <View style={{ gap: 17 }}>
          <Field
            label="Brand"
            value={brand}
            onChange={setBrand}
            placeholder="e.g. Le Labo"
          />
          <Field
            label="Fragrance name"
            value={name}
            onChange={setName}
            placeholder="e.g. Santal 33"
          />
          <View style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="Bottle size (ml)"
                value={size}
                onChange={setSize}
                numeric
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Remaining (%)"
                value={remaining}
                onChange={setRemaining}
                numeric
              />
            </View>
          </View>
          <View style={[ui.row, { paddingVertical: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={ui.name}>Open to swap</Text>
              <Text style={ui.small}>
                Let this bottle find its next chapter.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Open to swap"
              value={open}
              onValueChange={setOpen}
              trackColor={{ false: colors.line, true: colors.green }}
              thumbColor={colors.ivory}
            />
          </View>
        </View>
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={{
              fontFamily: fonts.medium,
              color: colors.error,
              lineHeight: 22,
            }}
          >
            {error}
          </Text>
        )}
        {permission && Platform.OS !== "web" && (
          <Button
            title="Open device settings"
            variant="outline"
            onPress={() => {
              void Linking.openSettings().catch(() =>
                setError(
                  "Please open Settings manually and allow camera or photo access.",
                ),
              );
            }}
          />
        )}
        <Button
          title="Add to my shelf  +"
          variant="lime"
          disabled={busy}
          onPress={save}
        />
        <Text style={[ui.small, { textAlign: "center" }]}>
          LOCAL PROTOTYPE · NOTHING IS UPLOADED
        </Text>
      </View>
    </Screen>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  numeric = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#7A8376"
        keyboardType={numeric ? "decimal-pad" : "default"}
        autoCapitalize={numeric ? "none" : "words"}
        style={s.input}
      />
    </View>
  );
}
const s = StyleSheet.create({
  preview: {
    backgroundColor: colors.soft,
    borderRadius: 24,
    minHeight: 284,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  badge: {
    position: "absolute",
    bottom: 14,
    left: 16,
    right: 16,
    alignItems: "center",
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.green,
    backgroundColor: colors.lime,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  input: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 54,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
});
