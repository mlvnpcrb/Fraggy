export type ApplicationMode = "live" | "demo";
export function chooseMode(
  username: string,
  password: string,
): ApplicationMode | null {
  return username.trim().toLowerCase() === "admin" && password === "admin"
    ? "demo"
    : null;
}
export async function loadApplication<T>(
  mode: ApplicationMode,
  loaders: Record<ApplicationMode, () => Promise<T>>,
): Promise<T> {
  return loaders[mode]();
}
