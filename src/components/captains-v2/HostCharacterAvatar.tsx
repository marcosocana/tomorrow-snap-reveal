import type { CaptainsHostCharacterConfig } from "@/lib/captainsTypes";
import { getHostSpriteConfig } from "@/lib/captainsHosts";
import CaptainModel from "./CaptainModel";
import "./HostCharacterAvatar.css";

export default function HostCharacterAvatar({ config, className = "" }: { config: CaptainsHostCharacterConfig; className?: string }) {
  return <span className={`host-avatar ${className}`} aria-hidden="true"><CaptainModel config={getHostSpriteConfig(config)} photoUrl={config.photo_url} /></span>;
}
