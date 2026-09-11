import type { CaptainsSpriteHairLength } from "./captainsTypes";

export const captainHairColorOptions = [
  { value: "blonde", label: "Rubio", color: "#d4a72c" },
  { value: "dark", label: "Negro", color: "#151515" },
  { value: "brown", label: "Castaño", color: "#6b4328" },
  { value: "red", label: "Pelirrojo", color: "#b54e28" },
  { value: "gray", label: "Gris", color: "#99999e" },
  { value: "white", label: "Blanco", color: "#eee8df" },
  { value: "pink", label: "Rosa", color: "#d76eae" },
] as const;

export const captainHairOptions: Array<{ value: CaptainsSpriteHairLength; label: string }> = [
  { value: "short", label: "Corto" },
  { value: "long", label: "Largo" },
  { value: "wavy", label: "Ondulado" },
  { value: "curly", label: "Rizado" },
  { value: "bob", label: "Media melena" },
  { value: "bun", label: "Recogido" },
  { value: "bald", label: "Sin pelo" },
  { value: "ponytail", label: "Coleta" },
  { value: "braids", label: "Trenzas" },
  { value: "afro", label: "Afro" },
  { value: "pixie", label: "Pixie" },
  { value: "side_part", label: "Raya al lado" },
];
