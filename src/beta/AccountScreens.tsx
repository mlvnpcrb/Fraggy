import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Platform, Share, Text } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useBeta } from "./Provider";
import { compressPhoto, gateway, supabase, uploadPhoto } from "./api";
import {
  Body,
  Button,
  Card,
  Feedback,
  Field,
  Page,
  Photo,
  Toggle,
  useAction,
  styles,
} from "./ui";
import type { BetaStack } from "./navigation";

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<BetaStack>>();
  const b = useBeta(),
    a = useAction(),
    me = b.session!.user.id,
    p = b.state.profiles.find((x) => x.id === me);
  const [name, setName] = useState(p?.name || ""),
    [handle, setHandle] = useState(p?.handle || ""),
    [city, setCity] = useState(p?.city || ""),
    [bio, setBio] = useState(p?.bio || ""),
    [shared, setShared] = useState(p?.shelf_public || false),
    [password, setPassword] = useState(""),
    [current, setCurrent] = useState(""),
    [deleting, setDeleting] = useState(false),
    [deleteChecked, setDeleteChecked] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (p) {
      setName(p.name);
      setHandle(p.handle);
      setCity(p.city);
      setBio(p.bio);
      setShared(p.shelf_public);
    }
  }, [p?.id]);
  return (
    <Page title="Your scent identity." subtitle={b.session!.user.email}>
      <Feedback {...a} />
      {notice && <Body>{notice}</Body>}
      {p?.avatar_url && <Photo path={p.avatar_url} height={140} />}
      <Field
        label="Handle"
        value={handle}
        onChangeText={(v) => setHandle(v.toLowerCase())}
        autoCapitalize="none"
        maxLength={31}
      />
      <Field
        label="Display name"
        value={name}
        onChangeText={setName}
        maxLength={80}
      />
      <Field
        label="Philippine city"
        value={city}
        onChangeText={setCity}
        maxLength={80}
      />
      <Field
        label="Bio"
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={160}
      />
      <Toggle
        label="Share my full shelf with invited members"
        value={shared}
        onChange={setShared}
      />
      <Body>
        Available trade bottles remain discoverable. Private addresses and
        conversations are visible only inside your trades.
      </Body>
      <Button
        title="Save profile"
        disabled={a.busy}
        onPress={() =>
          void a.act(async () => {
            if (!name.trim() || !city.trim())
              throw Error("Add your name and Philippine city.");
            await b.run("update_profile", {
              p_data: { name, handle, city, bio, shelf_public: shared },
            });
            setNotice("Profile saved.");
          })
        }
      />
      <Button
        title="Choose avatar"
        secondary
        disabled={a.busy}
        onPress={() =>
          void a.act(async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
            });
            if (result.canceled) return;
            const uri = await compressPhoto(result.assets[0].uri, 100000);
            const size =
              Platform.OS === "web"
                ? (await (await fetch(uri)).blob()).size
                : new File(uri).size;
            const ticket = await gateway<{ path: string; upload_url: string }>(
              "avatar-upload",
              { size },
            );
            await uploadPhoto(ticket.upload_url, uri);
            await b.run("attach_photo", { p_path: ticket.path });
          })
        }
      />
      <Card>
        <Field
          label="Current password"
          secureTextEntry
          value={current}
          onChangeText={setCurrent}
        />
        <Field
          label="New password (12+ characters)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Button
          title="Change password"
          secondary
          disabled={a.busy}
          onPress={() =>
            void a.act(async () => {
              if (password.length < 12)
                throw Error("Use at least 12 characters.");
              const reauth = await supabase.auth.signInWithPassword({
                email: b.session!.user.email!,
                password: current,
              });
              if (reauth.error) throw reauth.error;
              const result = await supabase.auth.updateUser({ password });
              if (result.error) throw result.error;
              setPassword("");
              setCurrent("");
              setNotice("Password updated.");
            })
          }
        />
      </Card>
      <Button
        title="Notifications"
        secondary
        onPress={() => navigation.navigate("Inbox")}
      />
      {b.state.is_admin && (
        <Button
          title="Founder administration"
          secondary
          onPress={() => navigation.navigate("Admin")}
        />
      )}
      <Card>
        <Body>Blocked collectors</Body>
        {b.state.blocks.map((block) => (
          <Button
            key={block.blocked_id}
            title={`Unblock ${block.blocked_id.slice(0, 8)}`}
            secondary
            disabled={a.busy}
            onPress={() =>
              void a.act(() =>
                b.run("block_collector", {
                  p_user: block.blocked_id,
                  p_block: false,
                }),
              )
            }
          />
        ))}
        <Body>Your reports</Body>
        {b.state.reports.map((report) => (
          <Body key={report.id}>
            {report.status} · {report.reason}
          </Body>
        ))}
      </Card>
      <Button
        title="Sign out"
        secondary
        disabled={a.busy}
        onPress={() => void a.act(b.signOut)}
      />
      <Button
        title="Delete my account"
        secondary
        onPress={() => setDeleting(!deleting)}
      />
      {deleting && (
        <Card>
          <Body>
            This removes your sign-in and profile and hides your bottles. Trade
            history and reviews remain anonymized for the other collector.
            Resolve accepted or paused exchanges first.
          </Body>
          <Field
            label="Confirm current password"
            secureTextEntry
            value={current}
            onChangeText={setCurrent}
          />
          <Toggle
            label="I understand account deletion is permanent"
            value={deleteChecked}
            onChange={setDeleteChecked}
          />
          <Button
            title="Permanently delete my account"
            disabled={!deleteChecked || a.busy}
            onPress={() =>
              void a.act(async () => {
                const result = await supabase.auth.signInWithPassword({
                  email: b.session!.user.email!,
                  password: current,
                });
                if (result.error) throw result.error;
                await gateway("delete-account");
                await b.signOut();
              })
            }
          />
        </Card>
      )}
      <Body>
        Need help or account recovery? Contact the founder who invited you.
        Fraggy beta supports bottle swaps within the Philippines.
      </Body>
    </Page>
  );
}

type AdminState = {
  suspended_bottles: { id: string; brand: string; name: string }[] | null;
  members:
    | {
        id: string;
        name: string;
        handle: string;
        admin: boolean;
        suspended: boolean;
      }[]
    | null;
  invites:
    | {
        id: string;
        email: string | null;
        purpose: string;
        expires_at: string;
        redeemed: boolean;
      }[]
    | null;
  reports:
    | {
        id: string;
        reason: string;
        status: string;
        reported_bottle_id: string | null;
        reported_user_id: string | null;
        trade_id: string | null;
      }[]
    | null;
  failed_jobs: { id: string; error: string; owner_id: string }[] | null;
  storage_bytes: number;
  database_bytes: number;
  worker_url: string | null;
};
export function AdminScreen({
  navigation,
}: NativeStackScreenProps<BetaStack, "Admin">) {
  const b = useBeta(),
    a = useAction();
  const [data, setData] = useState<AdminState | null>(null),
    [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [worker, setWorker] = useState(""),
    [token, setToken] = useState(""),
    [note, setNote] = useState(""),
    [notice, setNotice] = useState("");
  const load = async () => {
    const result = await b.run<AdminState>("admin_state");
    setData(result);
    setWorker(result.worker_url || "");
  };
  useEffect(() => {
    void a.act(load);
  }, []);
  if (!b.state.is_admin)
    return (
      <Page title="Founder access required" back={() => navigation.goBack()}>
        <Body>This area is restricted.</Body>
      </Page>
    );
  return (
    <Page
      title="Behind the shelf."
      subtitle="Founder administration · free private beta"
      back={() => navigation.goBack()}
    >
      <Feedback {...a} />
      {notice && <Body>{notice}</Body>}
      <Button
        title="Refresh operations"
        secondary
        disabled={a.busy}
        onPress={() => void a.act(load)}
      />
      <Body>
        {data?.members?.length || 0}/20 members ·{" "}
        {((data?.storage_bytes || 0) / 1000000).toFixed(1)}/800 MB photo storage
      </Body>
      <Body>
        Database size: {((data?.database_bytes || 0) / 1000000).toFixed(1)} MB ·
        monitor the 500 MB free database allowance in Supabase.
      </Body>
      <Card>
        <Field
          label="Invitation email (optional, binds the code)"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Button
          title="Create single-use invitation"
          disabled={a.busy}
          onPress={() =>
            void a.act(async () => {
              setCode(
                await b.run<string>("admin_invite", { p_email: email || null }),
              );
              await load();
            })
          }
        />
        {code && (
          <>
            <Body>Copy this code now. It is shown only once.</Body>
            <Text selectable style={styles.body}>
              {code}
            </Text>
          </>
        )}
      </Card>
      {(data?.members || []).map((member) => (
        <Card key={member.id}>
          <Text style={styles.label}>
            {member.name} · {member.handle}
            {member.admin ? " · Founder" : ""}
          </Text>
          <Body>{member.suspended ? "Restricted" : "Active"}</Body>
          {!member.admin && (
            <Button
              title={member.suspended ? "Restore account" : "Suspend account"}
              secondary
              disabled={a.busy}
              onPress={() =>
                void a.act(async () => {
                  await b.run("admin_action", {
                    p_action: member.suspended
                      ? "restore_user"
                      : "suspend_user",
                    p_id: member.id,
                  });
                  await load();
                })
              }
            />
          )}
          <Button
            title="Create recovery code after identity verification"
            secondary
            disabled={a.busy}
            onPress={() =>
              void a.act(async () => {
                setCode(
                  await b.run<string>("admin_invite", {
                    p_recovery: member.id,
                  }),
                );
                setNotice(
                  `Recovery code for ${member.handle}. Copy it from the invitation panel.`,
                );
              })
            }
          />
        </Card>
      ))}
      <Card>
        <Body>Invitations</Body>
        {(data?.invites || []).map((i) => (
          <Body key={i.id}>
            {i.email || "Unbound"} · {i.purpose} ·{" "}
            {i.redeemed
              ? "Used"
              : `Expires ${new Date(i.expires_at).toLocaleDateString()}`}
          </Body>
        ))}
      </Card>
      {(data?.suspended_bottles || []).map((item) => (
        <Card key={item.id}>
          <Body>
            Suspended listing · {item.brand} · {item.name}
          </Body>
          <Button
            title="Restore listing"
            secondary
            disabled={a.busy}
            onPress={() =>
              void a.act(async () => {
                await b.run("admin_action", {
                  p_action: "restore_bottle",
                  p_id: item.id,
                });
                await load();
              })
            }
          />
        </Card>
      ))}
      <Field
        label="Moderation note"
        value={note}
        onChangeText={setNote}
        maxLength={1000}
      />
      {(data?.reports || []).map((r) => (
        <Card key={r.id}>
          <Body>
            {r.status} · {r.reason}
          </Body>
          {r.reported_bottle_id && (
            <Button
              title="Suspend listing"
              secondary
              disabled={a.busy}
              onPress={() =>
                void a.act(() =>
                  b.run("admin_action", {
                    p_action: "suspend_bottle",
                    p_id: r.reported_bottle_id,
                  }),
                )
              }
            />
          )}
          <Button
            title="Mark report reviewed"
            secondary
            disabled={a.busy}
            onPress={() =>
              void a.act(async () => {
                await b.run("admin_action", {
                  p_action: "close_report",
                  p_id: r.id,
                  p_note: note,
                });
                await load();
              })
            }
          />
          <Body>
            Moderation cannot transfer bottle ownership or confirm receipt.
          </Body>
        </Card>
      ))}
      <Card>
        <Text style={styles.label}>PHOTO PROCESSING</Text>
        <Field
          label="Render worker HTTPS origin"
          value={worker}
          onChangeText={setWorker}
          autoCapitalize="none"
        />
        <Button
          title="Configure worker / rotate token"
          secondary
          disabled={a.busy}
          onPress={() =>
            void a.act(async () => {
              setToken(
                await b.run<string>("configure_worker", { p_url: worker }),
              );
              setNotice(
                "Set the new token in Render’s FRAGGY_WORKER_TOKEN environment variable. Old tokens stop working immediately.",
              );
            })
          }
        />
        {token && (
          <>
            <Body>
              Server secret · never paste into GitHub or app configuration.
            </Body>
            <Text selectable style={styles.body}>
              {token}
            </Text>
          </>
        )}
        {(data?.failed_jobs || []).map((j) => (
          <Body key={j.id}>
            {j.id.slice(0, 8)} · {j.error}
          </Body>
        ))}
      </Card>
      <Button
        title="Clean abandoned captures & expire offers"
        secondary
        disabled={a.busy}
        onPress={() =>
          void a.act(async () => {
            const result = await gateway<{ expired_captures: number }>(
              "maintenance",
            );
            setNotice(`Removed ${result.expired_captures} abandoned captures.`);
            await load();
          })
        }
      />
      <Button
        title="Export private application backup"
        secondary
        disabled={a.busy}
        onPress={() =>
          void a.act(async () => {
            const backup = await gateway("export-backup");
            await Share.share({
              message: JSON.stringify(backup, null, 2),
              title: "Fraggy private backup",
            });
            setNotice(
              "Keep this export private. Photo files require a separate storage export; see the deployment runbook.",
            );
          })
        }
      />
    </Page>
  );
}
