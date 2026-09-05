import type { CaptainsSpriteConfig, CaptainsSpriteOutfitType, CaptainsSpriteSex } from "./captainsTypes";

type ColorField = "dress_color" | "suit_color" | "tie_color" | "outfit_color" | "bottom_color";
type Outfit = {
  value: CaptainsSpriteOutfitType;
  label: string;
  sexes: CaptainsSpriteSex[];
  colors: { field: ColorField; label: string; fallback: string }[];
};
const everyone: CaptainsSpriteSex[] = ["male", "female", "unspecified"];
export const captainsOutfits: Outfit[] = [
  { value: "suit", label: "Traje", sexes: everyone, colors: [{ field: "suit_color", label: "Color traje", fallback: "#1f2937" }, { field: "tie_color", label: "Color corbata", fallback: "#f06a5f" }] },
  { value: "tuxedo", label: "Esmoquin", sexes: everyone, colors: [{ field: "suit_color", label: "Color esmoquin", fallback: "#1f2937" }, { field: "tie_color", label: "Color pajarita", fallback: "#f06a5f" }] },
  { value: "shirt", label: "Camisa y pantalón", sexes: everyone, colors: [{ field: "outfit_color", label: "Color camisa", fallback: "#d7e6ed" }, { field: "bottom_color", label: "Color pantalón", fallback: "#40516b" }] },
  { value: "casual", label: "Camiseta y vaqueros", sexes: everyone, colors: [{ field: "outfit_color", label: "Color camiseta", fallback: "#e59a79" }, { field: "bottom_color", label: "Color vaqueros", fallback: "#40516b" }] },
  { value: "dress", label: "Vestido", sexes: ["female", "unspecified"], colors: [{ field: "dress_color", label: "Color vestido", fallback: "#202235" }] },
  { value: "long_dress", label: "Vestido largo", sexes: ["female", "unspecified"], colors: [{ field: "dress_color", label: "Color vestido", fallback: "#202235" }] },
  { value: "jumpsuit", label: "Mono elegante", sexes: ["female", "unspecified"], colors: [{ field: "outfit_color", label: "Color mono", fallback: "#8a647f" }] },
  { value: "skirt", label: "Blusa y falda", sexes: ["female", "unspecified"], colors: [{ field: "outfit_color", label: "Color blusa", fallback: "#e8c7bb" }, { field: "bottom_color", label: "Color falda", fallback: "#40516b" }] },
];
export const getCaptainOutfit = (value?: string | null) => captainsOutfits.find(outfit => outfit.value === value) || captainsOutfits[0];
export const captainOutfitForSex = (config: CaptainsSpriteConfig | null | undefined, sex: CaptainsSpriteSex): CaptainsSpriteOutfitType => {
  const current = getCaptainOutfit(config?.outfit_type);
  return current.sexes.includes(sex) ? current.value : sex === "female" ? "dress" : "suit";
};
