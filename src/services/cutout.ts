import { Platform } from "react-native";
import Constants from "expo-constants";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import { cutoutServerUrl } from "./cutoutConfig";
import { appendNativePhoto } from "./nativePhotoUpload";
export type Cutout = { uri: string; width: number; height: number };
export function processorUrl() {
  return cutoutServerUrl(
    process.env.EXPO_PUBLIC_CUTOUT_URL,
    Constants.expoConfig?.hostUri,
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.location.origin
      : undefined,
  );
}
export async function removeBottleBackground(uri: string): Promise<Cutout> {
  const base = processorUrl();
  const photo = await manipulateAsync(uri, [{ resize: { width: 1280 } }], {
    compress: 0.9,
    format: SaveFormat.JPEG,
  });
  const body = new FormData();
  if (Platform.OS === "web") {
    const response = await fetch(photo.uri);
    body.append("file", await response.blob(), "bottle.jpg");
  } else appendNativePhoto(body, photo.uri, File);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`${base}/cutout`, {
      method: "POST",
      body,
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!result || typeof result !== "object")
      throw new Error(
        "The photo processor returned an unreadable response. Check its address and retry.",
      );
    if (!response.ok)
      throw new Error(
        typeof result.detail === "string"
          ? result.detail
          : "Could not cut out this bottle. Try another photo.",
      );
    if (
      typeof result.image !== "string" ||
      !result.image.startsWith("data:image/png;base64,") ||
      !Number.isFinite(result.width) ||
      !Number.isFinite(result.height)
    )
      throw new Error(
        "The processor returned an invalid cutout. Please retry.",
      );
    return { uri: result.image, width: result.width, height: result.height };
  } catch (error) {
    if (
      error instanceof Error &&
      !["TypeError", "AbortError"].includes(error.name)
    )
      throw error;
    throw new Error(
      "Could not reach the photo processor. Start it on your computer (port 8787), check your Wi-Fi, and retry.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
