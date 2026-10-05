export const whaleColors = [
  { name: "Lavender", value: "#926ab3", surface: "#88458f" },
  { name: "Ocean blue", value: "#83b5db", surface: "#689bc1" },
  { name: "Aqua", value: "#85d4da", surface: "#63afb8" },
  { name: "Seafoam", value: "#a3d7bd", surface: "#7ab69a" },
  { name: "Coral", value: "#eaa395", surface: "#ca8277" },
  { name: "Soft pink", value: "#e5b0cf", surface: "#c38eae" },
  { name: "Pearl / cream", value: "#ece4ca", surface: "#ccc0a5" },
  { name: "Deep blue", value: "#7186b7", surface: "#536b98" },
] as const;

export type WhaleColor = typeof whaleColors[number];
export type Preferences = { volume: number; muted: boolean; lastVolume: number; color: WhaleColor["value"] };
export const preferencesKey = "quiet-blue.preferences";
export const defaultPreferences: Preferences = { volume: 75, muted: false, lastVolume: 75, color: whaleColors[0].value };

export function parsePreferences(stored: string | null): Preferences {
  try {
    const value: unknown = JSON.parse(stored ?? "null");
    if (!value || typeof value !== "object") return defaultPreferences;
    const saved = value as Record<string, unknown>;
    const volume = typeof saved.volume === "number" && Number.isFinite(saved.volume)
      ? Math.round(Math.min(100, Math.max(0, saved.volume))) : 75;
    const lastVolume = typeof saved.lastVolume === "number" && Number.isFinite(saved.lastVolume) && saved.lastVolume > 0
      ? Math.round(Math.min(100, Math.max(1, saved.lastVolume))) : volume || 75;
    const color = whaleColors.find(color => color.value === saved.color)?.value ?? defaultPreferences.color;
    return { volume, muted: volume === 0 || saved.muted === true, lastVolume, color };
  } catch {
    return defaultPreferences;
  }
}

export function changeVolume(previous: Preferences, volume: number): Preferences {
  return { ...previous, volume, muted: volume === 0, lastVolume: volume > 0 ? volume : previous.lastVolume };
}

export function toggleMute(previous: Preferences): Preferences {
  return previous.muted || previous.volume === 0
    ? { ...previous, muted: false, volume: previous.lastVolume }
    : { ...previous, muted: true, lastVolume: previous.volume };
}
