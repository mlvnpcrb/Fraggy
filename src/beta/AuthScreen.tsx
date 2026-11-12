import React, { useState } from "react";
import { Body, Button, Choices, Feedback, Field, Page, useAction } from "./ui";
import { gateway, supabase } from "./api";
export function AuthScreen({ onBack }: { onBack?: () => void }) {
  const [mode, setMode] = useState<"Sign in" | "Join beta" | "Recovery">(
      "Sign in",
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [handle, setHandle] = useState(""),
    [name, setName] = useState(""),
    [city, setCity] = useState("");
  const a = useAction();
  return (
    <Page
      back={onBack}
      title="Your collection. On display."
      subtitle="A private space for Philippine fragrance collectors. Photograph it. Shelf it. Swap it."
    >
      <Choices
        label="Welcome to Fraggy"
        values={["Sign in", "Join beta", "Recovery"] as const}
        value={mode}
        onChange={setMode}
      />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <Field
        label={
          mode === "Recovery" ? "New password (12+ characters)" : "Password"
        }
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={mode === "Sign in" ? "current-password" : "new-password"}
      />
      {mode !== "Sign in" && (
        <Field
          label="Founder-issued single-use code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}{" "}
      {mode === "Join beta" && (
        <>
          <Field
            label="Unique handle, e.g. @scentclub"
            value={handle}
            onChangeText={(v) => setHandle(v.toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field label="Display name" value={name} onChangeText={setName} />
          <Field label="Philippine city" value={city} onChangeText={setCity} />
          <Body>
            Your full shelf starts private. Only bottles you mark available for
            trade appear in Discover.
          </Body>
        </>
      )}{" "}
      {mode === "Recovery" && (
        <Body>
          Ask Fraggy’s founder for a recovery code after they verify your
          identity. Password reset emails are not required for this beta.
        </Body>
      )}
      <Feedback {...a} />
      <Button
        title={mode}
        disabled={a.busy}
        onPress={() =>
          void a.act(async () => {
            if (mode !== "Sign in")
              await gateway(mode === "Join beta" ? "join" : "recover", {
                code: code.trim(),
                email: email.trim(),
                password,
                handle,
                name,
                city,
              });
            const { error } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (error) throw error;
          })
        }
      />
    </Page>
  );
}
