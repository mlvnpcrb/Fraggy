import React, { useState } from "react";
import { ScrollView, Text, TextInput, StyleSheet } from "react-native";
import { Action, Heading } from "../src/components/UI";
import { theme } from "../src/theme";
export default function Add() {
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [size, setSize] = useState("100");
  const [remaining, setRemaining] = useState("100");
  const [message, setMessage] = useState("");
  const fields = [
    { label: "Brand", value: brand, set: setBrand, numeric: false },
    { label: "Fragrance", value: name, set: setName, numeric: false },
    { label: "Bottle size (ml)", value: size, set: setSize, numeric: true },
    {
      label: "Remaining (ml)",
      value: remaining,
      set: setRemaining,
      numeric: true,
    },
  ];
  function submit() {
    const volume = Number(size),
      left = Number(remaining);
    if (
      !brand.trim() ||
      !name.trim() ||
      !size.trim() ||
      !remaining.trim() ||
      !Number.isFinite(volume) ||
      !Number.isFinite(left) ||
      volume <= 0 ||
      left < 0 ||
      left > volume
    ) {
      setMessage("Enter a valid brand, fragrance and bottle volume.");
      return;
    }
    setMessage(
      "Prototype only: data is not saved. Persistence is a later milestone.",
    );
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.page}
    >
      <Heading sub="Prototype form · data is not saved yet">
        Add a perfume
      </Heading>
      {fields.map((field) => (
        <React.Fragment key={field.label}>
          <Text style={s.label}>{field.label}</Text>
          <TextInput
            accessibilityLabel={field.label}
            style={s.input}
            value={field.value}
            onChangeText={field.set}
            keyboardType={field.numeric ? "decimal-pad" : "default"}
          />
        </React.Fragment>
      ))}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={s.message}>
          {message}
        </Text>
      ) : null}
      <Action title="Save perfume" onPress={submit} />
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: { padding: 24, paddingTop: 40, backgroundColor: theme.bg, flexGrow: 1 },
  label: {
    fontWeight: "700",
    color: theme.ink,
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: theme.ink,
  },
  message: { color: theme.ink, marginTop: 16, lineHeight: 22 },
});
