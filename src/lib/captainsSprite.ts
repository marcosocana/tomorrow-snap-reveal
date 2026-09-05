import type { CSSProperties } from "react";
import type { CaptainsSpriteConfig, CaptainsSpriteStyle } from "@/lib/captainsTypes";

const presets: Record<CaptainsSpriteStyle, { hair: string; skin: string; outfit: string; accent: string; legs: string; dressLike: boolean }> = {
  suit: { hair: "#3f2d23", skin: "#f0bd91", outfit: "#1f2937", accent: "#ffffff", legs: "#111827", dressLike: false },
  dress: { hair: "#5a3828", skin: "#f1c09a", outfit: "#202235", accent: "#ffffff", legs: "#202235", dressLike: true },
  jacket: { hair: "#111111", skin: "#8f5f3d", outfit: "#4f7f3a", accent: "#ffffff", legs: "#3b2f24", dressLike: false },
  skirt: { hair: "#1f1712", skin: "#9b6747", outfit: "#4c7d3f", accent: "#ffffff", legs: "#3b2f24", dressLike: true },
  festival: { hair: "#2b1b12", skin: "#efb68c", outfit: "#8a4f22", accent: "#f06a5f", legs: "#654321", dressLike: false },
  tunic: { hair: "#c9c9c9", skin: "#a87450", outfit: "#d5d5d5", accent: "#ffffff", legs: "#1f2937", dressLike: false },
  uniform: { hair: "#141414", skin: "#edb28f", outfit: "#d32027", accent: "#f8d24a", legs: "#d32027", dressLike: false },
  kimono: { hair: "#1c1c1c", skin: "#f2bd93", outfit: "#6fa341", accent: "#111111", legs: "#202235", dressLike: true },
};

const hairColors: Record<CaptainsSpriteConfig["hair_color"], string> = {
  blonde: "#d4a72c",
  dark: "#151515",
  brown: "#6b4328",
};

const skinColors: Record<CaptainsSpriteConfig["skin_color"], string> = {
  very_fair: "#f4d6c6",
  fair: "#e9b98f",
  tan: "#a66b45",
  dark: "#5d3828",
};

const safeColor = (value: string | null | undefined, fallback: string) =>
  /^#[0-9a-f]{6}$/i.test(value || "") ? value! : fallback;

export const getCaptainSpriteVisual = (value?: CaptainsSpriteStyle | null, config?: CaptainsSpriteConfig | null) => {
  if (!config) return { ...(presets[value || "suit"] || presets.suit), longHair: false };
  const outfit = config.outfit_type === "dress"
    ? safeColor(config.dress_color, "#202235")
    : safeColor(config.suit_color, "#1f2937");
  return {
    hair: hairColors[config.hair_color] || hairColors.dark,
    skin: skinColors[config.skin_color] || skinColors.fair,
    outfit,
    accent: config.outfit_type === "dress" ? "#ffffff" : safeColor(config.tie_color, "#f06a5f"),
    legs: config.outfit_type === "dress" ? "#202235" : outfit,
    dressLike: config.outfit_type === "dress",
    longHair: config.hair_length === "long",
  };
};

export const getCaptainSpriteCss = (value?: CaptainsSpriteStyle | null, config?: CaptainsSpriteConfig | null): CSSProperties => {
  const visual = getCaptainSpriteVisual(value, config);
  return {
    "--outfit": visual.outfit,
    "--skin": visual.skin,
    "--hair": visual.hair,
    "--accent": visual.accent,
    "--legs": visual.legs,
  } as CSSProperties;
};
