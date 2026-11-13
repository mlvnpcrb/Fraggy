import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { File, Directory, Paths } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import {
  storeWebOriginal,
  resolveWebOriginal,
  clearWebOriginals,
  removeWebOriginal,
} from "./webDraftPhotos";
import * as ImageManipulator from "expo-image-manipulator";

export const projectUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://flczhwwlvfnkqmtxpkmq.supabase.co";
const publicKey =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  "sb_publishable_pEm8Hyrti1hyuqisr5wtgQ_GfQOd43P";
// SecureStore values have a platform size limit. Each session is split into
// small chunks; AsyncStorage never holds native refresh tokens.
const secureStorage = {
  async getItem(key: string) {
    if (Platform.OS === "web") return AsyncStorage.getItem(key);
    const count = Number(await SecureStore.getItemAsync(key));
    if (!count) return null;
    let value = "";
    for (let i = 0; i < count; i++)
      value += (await SecureStore.getItemAsync(`${key}.${i}`)) || "";
    return value || null;
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") return AsyncStorage.setItem(key, value);
    await this.removeItem(key);
    const chunks = value.match(/[\s\S]{1,1500}/g) || [];
    for (let i = 0; i < chunks.length; i++)
      await SecureStore.setItemAsync(`${key}.${i}`, chunks[i]);
    await SecureStore.setItemAsync(key, String(chunks.length));
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") return AsyncStorage.removeItem(key);
    const count = Number(await SecureStore.getItemAsync(key));
    for (let i = 0; i < count; i++)
      await SecureStore.deleteItemAsync(`${key}.${i}`);
    await SecureStore.deleteItemAsync(key);
  },
};
export const supabase = createClient(projectUrl, publicKey, {
  auth: {
    storage: secureStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
export async function rpc<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
  expectedUserId?: string,
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (expectedUserId && session?.user.id !== expectedUserId)
    throw Error("Your account changed.");
  const response = await fetch(
    `${projectUrl}/rest/v1/rpc/${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: {
        apikey: publicKey,
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(args),
    },
  );
  const raw = await response.text();
  const result = raw ? JSON.parse(raw) : null;
  if (!response.ok) throw Error(result?.message || "Could not reach Fraggy.");
  return result as T;
}
export async function gateway<T = unknown>(
  action: string,
  data: Record<string, unknown> = {},
  expectedUserId?: string,
  isCurrent?: () => boolean,
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (
    (expectedUserId && session?.user.id !== expectedUserId) ||
    (isCurrent && !isCurrent())
  )
    throw Error("Your account changed.");
  const response = await fetch(`${projectUrl}/functions/v1/beta-gateway`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publicKey,
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ action, ...data }),
  });
  const result = await response.json();
  if (!response.ok || result.error)
    throw Error(result.error || "Could not reach Fraggy. Your draft is saved.");
  return result as T;
}
export async function resolveDraftPhoto(uri: string, userId?: string) {
  if (Platform.OS !== "web" || !uri.startsWith("fraggy-draft:")) return uri;
  const id = userId || (await supabase.auth.getSession()).data.session?.user.id;
  if (!id) throw Error("Sign in to resume this photo.");
  return resolveWebOriginal(uri, id);
}
export async function compressPhoto(uri: string, limit = 500000) {
  uri = await resolveDraftPhoto(uri);
  for (const width of [1400, 1100, 850, 650, 450]) {
    const photo = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width } }],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
    );
    const size =
      Platform.OS === "web"
        ? (await (await fetch(photo.uri)).blob()).size
        : new File(photo.uri).size;
    if (size <= limit) return photo.uri;
  }
  throw Error("Photo is too large. Try a closer picture of the bottle.");
}
export async function uploadPhoto(url: string, uri: string) {
  const body =
    Platform.OS === "web" ? await (await fetch(uri)).blob() : new File(uri);
  const response = await expoFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body,
  });
  if (!response.ok)
    throw Error(
      "Photo upload interrupted. Your draft is saved; retry when connected.",
    );
}
export const cacheDirectory = () =>
  new Directory(Paths.document, "fraggy-beta");
export async function localPhoto(uri: string, id: string, userId: string) {
  if (Platform.OS === "web") {
    const epoch = mediaEpoch.get(userId) || 0;
    const reference = await storeWebOriginal(uri, userId, id);
    if (epoch !== (mediaEpoch.get(userId) || 0)) {
      await removeWebOriginal(reference, userId);
      throw Error("Your account changed.");
    }
    return reference;
  }
  const directory = new Directory(cacheDirectory(), userId);
  directory.create({ idempotent: true, intermediates: true });
  const file = new File(directory, `${id}.jpg`);
  new File(uri).copy(file);
  return file.uri;
}
const mediaEpoch = new Map<string, number>();
export async function mediaUri(path: string, userId: string, offline = false) {
  const generation = mediaEpoch.get(userId) || 0;
  const active = () => generation === (mediaEpoch.get(userId) || 0);
  if (/^https?:|^data:/.test(path))
    throw Error("Only private photo references are supported.");
  if (Platform.OS !== "web") {
    const dir = new Directory(cacheDirectory(), userId);
    dir.create({ idempotent: true, intermediates: true });
    const file = new File(dir, path.replace(/[^a-z0-9.-]/gi, "_"));
    if (file.exists) return file.uri;
    if (offline) throw Error("Photo is not cached.");
    const { data, error } = await supabase.storage
      .from("cutouts")
      .createSignedUrl(path, 120);
    if (error) throw error;
    if (!active()) throw Error("Your account changed.");
    await File.downloadFileAsync(data.signedUrl, file, { idempotent: true });
    if (!active()) {
      if (file.exists) file.delete();
      throw Error("Your account changed.");
    }
    return file.uri;
  }
  const { data, error } = await supabase.storage
    .from("cutouts")
    .createSignedUrl(path, 120);
  if (error) throw error;
  return data.signedUrl;
}
export async function clearPrivateCache(userId: string) {
  mediaEpoch.set(userId, (mediaEpoch.get(userId) || 0) + 1);
  await AsyncStorage.removeItem(`fraggy.collection.${userId}`);
  await AsyncStorage.removeItem(`fraggy.drafts.${userId}`);
  if (Platform.OS === "web") await clearWebOriginals(userId);
  if (Platform.OS !== "web") {
    const dir = new Directory(cacheDirectory(), userId);
    if (dir.exists) dir.delete();
  }
}
