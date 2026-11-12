// Shared screens load the live SDK only after the application mode gate.
let mode: "live" | "demo" = "demo";
export function setRuntimeMode(next: "live" | "demo") {
  mode = next;
}
export async function getLiveApi() {
  if (mode !== "live")
    throw Error("This action is unavailable in the isolated demo.");
  return import("./api");
}
export async function gateway<T = unknown>(
  action: string,
  data: Record<string, unknown> = {},
  expectedUserId?: string,
): Promise<T> {
  return (await getLiveApi()).gateway<T>(action, data, expectedUserId);
}
export async function compressPhoto(uri: string, limit?: number) {
  return (await getLiveApi()).compressPhoto(uri, limit);
}
export async function localPhoto(uri: string, id: string, userId: string) {
  return (await getLiveApi()).localPhoto(uri, id, userId);
}
export async function uploadPhoto(url: string, uri: string) {
  return (await getLiveApi()).uploadPhoto(url, uri);
}
export async function mediaUri(path: string, userId: string, offline = false) {
  if (mode === "demo") {
    if (path.startsWith("data:image/png;base64,")) return path;
    throw Error("No demo photo available.");
  }
  return (await getLiveApi()).mediaUri(path, userId, offline);
}

export async function resolveDraftPhoto(uri: string, userId: string) {
  if (mode === "demo") {
    if (uri.startsWith("data:image/png;base64,")) return uri;
    throw Error("Use the labelled demo sample.");
  }
  return (await getLiveApi()).resolveDraftPhoto(uri, userId);
}
