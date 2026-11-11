import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { mediaUri } from "./api";
import { useBeta } from "./Provider";
import type { BottleForm } from "./types";
export function Page({
  title,
  subtitle,
  children,
  back,
}: {
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
          contentContainerStyle={styles.content}
        >
          {back && <Button title="← Back" onPress={back} secondary />}
          <Text style={styles.wordmark}>fraggy.</Text>
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
          {!beta.session && beta.error && <Body>{beta.error}</Body>}
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
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        disabled && { opacity: 0.4 },
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
}: {
  path: string | null | undefined;
  height?: number;
}) {
  const { session, offline } = useBeta();
  const [uri, setUri] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setUri("");
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
        backgroundColor: colors.pale,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
          accessibilityLabel="Collector’s actual bottle photo"
          onError={() => setFailed(true)}
        />
      ) : failed || !path ? (
        <Body>Photo unavailable</Body>
      ) : (
        <ActivityIndicator color={colors.green} />
      )}
    </View>
  );
}
export function BottleFields({
  value,
  onChange,
}: {
  value: BottleForm;
  onChange: (v: BottleForm) => void;
}) {
  const patch = (p: Partial<BottleForm>) => onChange({ ...value, ...p });
  return (
    <>
      <Field
        label="Brand"
        value={value.brand}
        onChangeText={(brand) => patch({ brand })}
        maxLength={80}
      />
      <Field
        label="Fragrance"
        value={value.name}
        onChangeText={(name) => patch({ name })}
        maxLength={100}
      />
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
        label="Condition notes"
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
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return {
    busy,
    error,
    setError,
    act: async (task: () => Promise<unknown>) => {
      if (busy) return;
      setBusy(true);
      setError("");
      try {
        await task();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Something went wrong. Try again.",
        );
      } finally {
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
  content: { padding: 22, paddingBottom: 60, gap: 16 },
  wordmark: {
    fontFamily: fonts.bold,
    color: colors.green,
    fontSize: 26,
    letterSpacing: -1,
  },
  title: {
    fontFamily: fonts.bold,
    color: colors.green,
    fontSize: 34,
    letterSpacing: -1,
  },
  body: {
    fontFamily: fonts.regular,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 23,
  },
  label: { fontFamily: fonts.bold, color: colors.green, fontSize: 12 },
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    padding: 14,
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.line,
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
