import type { CaptainsEvent, CaptainsHostCharacterConfig, CaptainsHostConfig, CaptainsWeddingContext } from "@/lib/captainsTypes";

export const emptyCaptainsWeddingContext = (): CaptainsWeddingContext => ({
  partner_1_name: "", partner_1_nickname: "", partner_2_name: "", partner_2_nickname: "",
  years_together: null, relationship_start_date: "", venue_name: "", venue_city: "", venue_region: "",
  venue_country: "", venue_address: "", how_they_met: "", met_location: "", city_where_they_live: "",
  shared_hobby: "", special_song: "", inside_phrase: "", most_competitive_partner: "", fun_fact: "",
});

export const defaultHostCharacter = (index: 1 | 2): CaptainsHostCharacterConfig => ({
  linked_partner: index === 1 ? "partner_1" : "partner_2",
  display_name: "",
  skin_tone: index === 1 ? "medium" : "light",
  hair_style: index === 1 ? "short" : "long",
  hair_color: index === 1 ? "dark" : "brown",
  facial_hair: "none",
  glasses: "none",
  head_accessory: "none",
  outfit: index === 1 ? "classic_suit" : "modern_dress",
  primary_color: index === 1 ? "#2f3b52" : "#f06a5f",
  secondary_color: "#fff6ec",
  accessory: "none",
});

export const defaultCaptainsHostConfig = (enabled = true): CaptainsHostConfig => ({
  enabled,
  tone: "divertido",
  frequency: "normal",
  wedding: emptyCaptainsWeddingContext(),
  character_1: defaultHostCharacter(1),
  character_2: defaultHostCharacter(2),
});

export const normalizeCaptainsHostConfig = (event?: Partial<CaptainsEvent> | null, enabledForNew = false): CaptainsHostConfig => {
  const defaults = defaultCaptainsHostConfig(enabledForNew);
  return {
    enabled: event?.host_characters_enabled ?? defaults.enabled,
    tone: event?.host_tone ?? defaults.tone,
    frequency: event?.host_frequency ?? defaults.frequency,
    wedding: { ...defaults.wedding, ...(event?.wedding_context ?? {}) },
    character_1: { ...defaults.character_1, ...(event?.character_1_config ?? {}) },
    character_2: { ...defaults.character_2, ...(event?.character_2_config ?? {}) },
  };
};

export const getHostDisplayName = (config: CaptainsHostConfig, character: 1 | 2) => {
  const avatar = character === 1 ? config.character_1 : config.character_2;
  const partner = character === 1
    ? config.wedding.partner_1_nickname || config.wedding.partner_1_name
    : config.wedding.partner_2_nickname || config.wedding.partner_2_name;
  return avatar.display_name.trim() || partner.trim() || (character === 1 ? "Capitán" : "Capitana");
};
