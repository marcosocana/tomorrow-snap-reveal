import type { CaptainsHostCharacterConfig } from "@/lib/captainsTypes";
import "./HostCharacterAvatar.css";

const skin = { light: "#f7d8c5", medium: "#dda276", tan: "#b8754d", deep: "#70452f" };
const hair = { blonde: "#d9b34d", brown: "#70432b", dark: "#292326", red: "#a64e35", gray: "#9b9694" };

export default function HostCharacterAvatar({ config, className = "" }: { config: CaptainsHostCharacterConfig; className?: string }) {
  const dress = config.outfit.includes("dress");
  return <span className={`host-avatar ${className}`} aria-hidden="true">
    <svg viewBox="0 0 180 230" role="presentation">
      <ellipse cx="90" cy="218" rx="55" ry="9" fill="#3c2925" opacity=".13" />
      <path d={dress ? "M57 126c5-22 61-22 66 0l20 82H37Z" : "M53 126c9-23 65-23 74 0l-5 78H58Z"} fill={config.primary_color} stroke="#3c3031" strokeWidth="3" />
      {!dress && <><path d="m72 120 18 34 18-34" fill={config.secondary_color} stroke="#3c3031" strokeWidth="2"/><path d="M90 152v50" stroke="#fff" opacity=".28" /></>}
      {dress && <path d="M67 136q23 15 46 0" stroke={config.secondary_color} strokeWidth="6" fill="none" />}
      <path d="M58 134 38 181M122 134l20 47" stroke={config.primary_color} strokeWidth="20" strokeLinecap="round" />
      <circle cx="36" cy="186" r="10" fill={skin[config.skin_tone]} /><circle cx="144" cy="186" r="10" fill={skin[config.skin_tone]} />
      <rect x="79" y="91" width="22" height="29" rx="10" fill={skin[config.skin_tone]} />
      <circle cx="90" cy="66" r="43" fill={skin[config.skin_tone]} stroke="#3c3031" strokeWidth="3" />
      {config.hair_style !== "bald" && <path d={config.hair_style === "long" ? "M48 71c-8-57 93-66 86 4l-5 39-20-9 10-49c-18-16-45-17-60 1l10 49-20 8Z" : config.hair_style === "curly" ? "M48 62c2-50 83-53 87 2-6-4-10-7-16-8-8-18-48-22-61 1Z" : config.hair_style === "wave" ? "M48 61c4-45 77-53 87 0-20-16-37-1-50-12-12 12-23 4-37 12Z" : "M49 61c2-45 79-53 85 1-18-14-36-3-49-13-12 11-24 5-36 12Z"} fill={hair[config.hair_color]} stroke="#3c3031" strokeWidth="3" />}
      <circle cx="74" cy="70" r="3.7" fill="#332b2b" /><circle cx="106" cy="70" r="3.7" fill="#332b2b" />
      <path d="M78 88q12 9 24 0" stroke="#a65353" strokeWidth="3" fill="none" strokeLinecap="round" />
      {config.facial_hair !== "none" && <path d={config.facial_hair === "beard" ? "M64 84q26 32 52 0-4 30-26 31S68 105 64 84Z" : "M73 91q17 12 34 0"} fill={config.facial_hair === "beard" ? hair[config.hair_color] : "none"} stroke={hair[config.hair_color]} strokeWidth="3" />}
      {config.glasses !== "none" && <g fill="none" stroke="#302b2e" strokeWidth="3"><rect x="60" y="60" width="27" height="20" rx={config.glasses === "round" ? 10 : 3}/><rect x="93" y="60" width="27" height="20" rx={config.glasses === "round" ? 10 : 3}/><path d="M87 68h6" /></g>}
      {config.head_accessory === "crown" && <path d="m66 28 8-22 16 15 16-15 8 22Z" fill="#ffd75d" stroke="#8d6119" strokeWidth="3" />}
      {config.head_accessory === "hat" && <><path d="M62 30h57" stroke="#332c30" strokeWidth="9" strokeLinecap="round"/><path d="M70 28V6h40v22" fill={config.secondary_color} stroke="#332c30" strokeWidth="3"/></>}
      {config.accessory === "tie" && <path d="m86 142 4-7 5 7-2 28-5 6-5-6Z" fill={config.secondary_color}/>} 
      {config.accessory === "bowtie" && <path d="m90 145-14-8v18l14-7 14 7v-18Z" fill={config.secondary_color}/>} 
      {config.accessory === "bouquet" && <g><circle cx="142" cy="178" r="12" fill="#f4a1a5"/><circle cx="132" cy="181" r="10" fill="#fff0b3"/></g>}
      {config.accessory === "glass" && <path d="M137 164h16l-4 17h-8Zm8 17v12m-7 0h14" fill="#d8f1ff" stroke="#3c3031" strokeWidth="2"/>}
    </svg>
  </span>;
}
