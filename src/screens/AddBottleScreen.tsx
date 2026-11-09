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
  ActivityIndicator,
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
import { removeBottleBackground, type Cutout } from "../services/cutout";
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
  const [cutout, setCutout] = useState<Cutout>();
  const [removing, setRemoving] = useState(false);
  const pick = async (camera: boolean) => {
    if (busy || removing) return;
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
        setCutout(undefined);
        await removeBackground(result.assets[0].uri);
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
  const removeBackground = async (source = uri) => {
    if (!source || removing) return;
    setRemoving(true);
    setError("");
    try {
      setCutout(await removeBottleBackground(source));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not remove the background. Please retry.",
      );
    } finally {
      setRemoving(false);
    }
  };
  const save = () => {
    try {
      if (!image) throw Error("Choose a photo or try the sample cutout first.");
      if (!sample && !cutout)
        throw Error(
          "Your bottle cutout is not ready. Retry processing or choose another photo.",
        );
      if (!size.trim() || !remaining.trim())
        throw Error("Enter the bottle size and remaining amount.");
      addBottle({
        brand,
        name,
        sizeMl: Number(size),
        remainingPercent: Number(remaining),
        imageKind: sample ? "sample-cutout" : "cutout",
        imageUri: cutout?.uri,
        imageWidth: cutout?.width,
        imageHeight: cutout?.height,
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
          Take a photo. We’ll cut out the bottle and place it on your shelf.
        </Text>
        <View
          style={[
            s.preview,
            cutout || sample ? { backgroundColor: colors.green } : undefined,
          ]}
        >
          {(cutout || sample) && (
            <View
              style={{
                position: "absolute",
                bottom: 25,
                left: 25,
                right: 25,
                height: 8,
                borderRadius: 2,
                backgroundColor: "#829578",
                boxShadow: "0 6px 8px #061A1577",
              }}
            />
          )}
          {image ? (
            <>
              <Bottle
                bottle={{
                  ...sampleBottle,
                  imageUri: cutout?.uri ?? (sample ? undefined : uri),
                  imageKind: cutout
                    ? "cutout"
                    : sample
                      ? "sample-cutout"
                      : "original",
                  imageWidth: cutout?.width,
                  imageHeight: cutout?.height,
                }}
                size={230}
              />
              <View style={s.badge}>
                <Text style={s.badgeText}>
                  {sample
                    ? "SAMPLE CUTOUT · DEMO"
                    : cutout
                      ? "BACKGROUND REMOVED"
                      : "YOUR ORIGINAL PHOTO"}
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
        {!!uri && !cutout && !removing && !!error && (
          <Button
            title="Retry cutout"
            variant="lime"
            onPress={() => {
              void removeBackground();
            }}
          />
        )}
        {removing && (
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <ActivityIndicator color={colors.green} />
            <Text style={[ui.small, { flex: 1 }]}>
              Cutting out your bottle automatically. Your first cutout may take
              a little longer.
            </Text>
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button
            style={{ flex: 1 }}
            title={busy ? "Opening…" : "Choose photo"}
            disabled={busy || removing}
            onPress={() => {
              void pick(false);
            }}
          />
          <Button
            style={{ flex: 1 }}
            title="Camera"
            variant="outline"
            disabled={busy || removing}
            onPress={() => {
              void pick(true);
            }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={removing}
          onPress={() => {
            setSample(true);
            setUri(undefined);
            setCutout(undefined);
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
            ? "A sample bottle for exploring your shelves. Choose your own photo to try real background removal."
            : cutout
              ? "Background removed. Check the edges before placing your bottle. Choose another photo to retake it."
              : "Taking or choosing a photo sends it to the Fraggy processor on your computer to remove its background. The upload is not saved there. Use a plain background and keep hands out of frame."}
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
          disabled={busy || removing || (Boolean(uri) && !cutout)}
          onPress={save}
        />
        <Text style={[ui.small, { textAlign: "center" }]}>
          PHOTO → CUTOUT → YOUR DIGITAL SHELF
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
