import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts } from "../theme";
import { mediaUri } from "./runtime";
import { useBeta } from "./context";
import { FragranceEditor } from "../features/catalog/FragranceEditor";
import type { BottleForm } from "./types";
export function Page({
  title,
  subtitle,
  children,
  back,
  compact = false,
}: {
  compact?: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  back?: () => void;
}) {
  const beta = useBeta();
  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, compact && { gap: 8 }]}
        >
          {beta.mode === "demo" && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.pale,
                borderRadius: 12,
                paddingHorizontal: 10,
              }}
            >
              <Text style={[styles.label, { flex: 1 }]}>
                DEMO · Sample data
              </Text>
              <Button
                title="Exit demo"
                secondary
                onPress={() => void beta.signOut()}
              />
            </View>
          )}
          {back && <Button title="← Back" onPress={back} secondary />}
          {!compact && <Text style={styles.wordmark}>fraggy.</Text>}
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.body}>{subtitle}</Text>}
          {beta.session && beta.offline && (
            <Card>
              <Body>
                Showing your last saved shelf. Reconnect before uploading or
                changing a trade.
              </Body>
              <Body>{beta.error}</Body>
            </Card>
          )}
          {beta.error && !beta.offline && (
            <Card>
              <Body>{beta.error}</Body>
              <Button
                title="Retry connection"
                secondary
                onPress={() => void beta.refresh()}
              />
            </Card>
          )}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Body({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}
export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.75 },
        focused && { outlineColor: colors.green, outlineWidth: 3 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: colors.green }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel || label}
        style={[
          styles.input,
          props.multiline && { minHeight: 90 },
          props.style,
        ]}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.body, { flex: 1 }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.green }}
      />
    </View>
  );
}
export function Choices<T extends string>({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.wrap}>
        {values.map((v) => (
          <Button
            key={v}
            title={v}
            secondary={v !== value}
            onPress={() => onChange(v)}
          />
        ))}
      </View>
    </View>
  );
}
export function Photo({
  path,
  height = 220,
  background = colors.pale,
}: {
  path: string | null | undefined;
  height?: number;
  background?: string;
}) {
  const { session, offline } = useBeta();
  const [zoom, setZoom] = useState(false),
    [enlarged, setEnlarged] = useState(false);
  const [uri, setUri] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setUri("");
    setZoom(false);
    setFailed(false);
    if (path && session)
      mediaUri(path, session.user.id, offline)
        .then((u) => {
          if (active) setUri(u);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    return () => {
      active = false;
    };
  }, [path, session?.user.id, offline]);
  return (
    <View
      style={{
        height,
        backgroundColor: background,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri && !failed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Inspect bottle photo"
          onPress={() => setZoom(true)}
          style={{ width: "100%", height: "100%" }}
        >
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
            accessibilityLabel="Collector’s actual bottle photo"
            onError={() => setFailed(true)}
          />
        </Pressable>
      ) : failed || !path ? (
        <Body>Photo unavailable</Body>
      ) : (
        <ActivityIndicator color={colors.green} />
      )}
      <Modal
        visible={zoom}
        transparent={false}
        onRequestClose={() => setZoom(false)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: background, padding: 20, gap: 12 }}
        >
          <Button
            title="Close photo inspection"
            secondary
            onPress={() => setZoom(false)}
          />
          <Button
            title={enlarged ? "Fit photo" : "Enlarge photo"}
            secondary
            onPress={() => setEnlarged(!enlarged)}
          />
          <ScrollView
            horizontal
            contentContainerStyle={{
              minWidth: "100%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ScrollView
              contentContainerStyle={{
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Image
                source={{ uri }}
                accessibilityLabel="Enlarged actual bottle photo"
                resizeMode="contain"
                style={{
                  width: enlarged ? 650 : 300,
                  height: enlarged ? 1000 : 450,
                }}
              />
            </ScrollView>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
export function BottleFields({
  value,
  onChange,
  showIdentity = true,
}: {
  showIdentity?: boolean;
  value: BottleForm;
  onChange: (v: BottleForm) => void;
}) {
  const patch = (p: Partial<BottleForm>) => onChange({ ...value, ...p });
  return (
    <>
      {showIdentity && <FragranceEditor value={value} onChange={onChange} />}
      <Field
        label="Bottle size (ml)"
        keyboardType="number-pad"
        value={String(value.size_ml || "")}
        onChangeText={(v) => patch({ size_ml: Number(v.replace(/\D/g, "")) })}
      />
      <Field
        label="Remaining (%)"
        keyboardType="number-pad"
        value={String(value.remaining_percent)}
        onChangeText={(v) =>
          patch({ remaining_percent: Number(v.replace(/\D/g, "")) })
        }
      />
      <Choices
        label="Condition"
        values={["new", "excellent", "good", "fair"]}
        value={value.condition}
        onChange={(condition) => patch({ condition })}
      />
      <Toggle
        label="Cap included"
        value={value.has_cap}
        onChange={(has_cap) => patch({ has_cap })}
      />
      <Toggle
        label="Box included"
        value={value.has_box}
        onChange={(has_box) => patch({ has_box })}
      />
      <Toggle
        label="Available for a bottle swap"
        value={value.trade_available}
        onChange={(trade_available) => patch({ trade_available })}
      />
      {(["local", "shipping"] as const).map((method) => (
        <Toggle
          key={method}
          label={method === "local" ? "Local meetup" : "Manual shipping"}
          value={value.methods.includes(method)}
          onChange={(on) =>
            patch({
              methods: on
                ? [...value.methods, method]
                : value.methods.filter((m) => m !== method),
            })
          }
        />
      ))}
      <Field
        label="Personal and condition notes"
        multiline
        value={value.notes}
        maxLength={1000}
        onChangeText={(notes) => patch({ notes })}
      />
    </>
  );
}
export function validBottle(form: BottleForm) {
  if (!form.brand.trim() || !form.name.trim())
    throw Error("Add the brand and fragrance name.");
  if (
    form.size_ml < 1 ||
    form.size_ml > 1000 ||
    form.remaining_percent < 0 ||
    form.remaining_percent > 100
  )
    throw Error("Use a size of 1–1000 ml and remaining amount of 0–100%.");
  if (!form.methods.length) throw Error("Choose at least one exchange method.");
}
export function useAction() {
  const lock = React.useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return {
    busy,
    error,
    setError,
    act: async (task: () => Promise<unknown>) => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError("");
      try {
        await task();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Something went wrong. Try again.",
        );
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
  };
}
export function Feedback({ busy, error }: { busy: boolean; error: string }) {
  return (
    <>
      {busy && <ActivityIndicator color={colors.green} />}{" "}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.error, fontFamily: fonts.medium }}
        >
          {error}
        </Text>
      )}
    </>
  );
}
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: 20, paddingBottom: 60, gap: 16 },
  wordmark: {
    fontFamily: fonts.bold,
    color: colors.green,
    fontSize: 26,
    letterSpacing: -1,
  },
  title: {
    fontFamily: fonts.bold,
    color: colors.green,
    fontSize: 24,
    letterSpacing: -1,
  },
  body: {
    fontFamily: fonts.regular,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 26,
  },
  label: { fontFamily: fonts.bold, color: colors.green, fontSize: 14 },
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    padding: 14,
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: colors.green,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: { fontFamily: fonts.bold, color: colors.ivory, fontSize: 13 },
  secondary: { backgroundColor: colors.pale },
  card: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});

export function Sheet({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,.45)",
        }}
      >
        <Pressable
          accessibilityLabel="Dismiss sheet"
          accessibilityRole="button"
          onPress={onClose}
          style={{ flex: 1, minHeight: 48 }}
        />
        <SafeAreaView
          edges={["bottom"]}
          style={{
            backgroundColor: colors.ivory,
            maxHeight: "85%",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, gap: 16 }}
            accessibilityViewIsModal
          >
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Button title="Done" secondary onPress={onClose} />
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
