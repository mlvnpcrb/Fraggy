export function cutoutServerUrl(
  explicit?: string,
  hostUri?: string | null,
  webOrigin?: string,
) {
  if (explicit) {
    const url = new URL(explicit);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("Cutout URL must use HTTP or HTTPS.");
    return explicit.replace(/\/$/, "");
  }
  if (webOrigin) {
    const origin = new URL(webOrigin);
    return `${origin.protocol}//${origin.hostname}:8787`;
  }
  if (hostUri) {
    const host = new URL(`http://${hostUri}`).hostname;
    if (
      !/^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d{1,3}\.\d{1,3}|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(
        host,
      ) &&
      !host.endsWith(".local")
    )
      throw new Error(
        "Set EXPO_PUBLIC_CUTOUT_URL to a reachable photo processor when using a tunnel.",
      );
    return `http://${host}:8787`;
  }
  throw new Error(
    "Start the photo processor on your computer, then reopen Fraggy through Expo on the same Wi-Fi.",
  );
}
