import HostCharacterAvatar from "./HostCharacterAvatar";
import { getHostDisplayName } from "@/lib/captainsHosts";
import type { CaptainsHostConfig } from "@/lib/captainsTypes";
import type { HostMessageTemplate } from "@/lib/captainsHostMessages";
import "./HostIntervention.css";

export default function HostIntervention({ config, message, onContinue, preview = false }: {
  config: CaptainsHostConfig;
  message: HostMessageTemplate;
  onContinue?: () => void;
  preview?: boolean;
}) {
  const firstActive = message.speaker !== "character_2";
  const secondActive = message.speaker !== "character_1";
  const dialogue = message.speaker === "both" ? <>
    <div className="is-active"><strong>{getHostDisplayName(config, 1)}</strong><p>{message.line1}</p></div>
    {message.line2 && <div className="is-active"><strong>{getHostDisplayName(config, 2)}</strong><p>{message.line2}</p></div>}
  </> : <div className="is-active"><strong>{getHostDisplayName(config, message.speaker === "character_1" ? 1 : 2)}</strong><p>{message.line1}</p>{message.line2 && <p>{message.line2}</p>}</div>;
  return <div className={`host-intervention ${preview ? "is-preview" : ""}`}>
    <div className="host-intervention-stage" aria-label="Anfitriones de la boda">
      <HostCharacterAvatar config={config.character_1} className={firstActive ? "is-speaking" : ""} />
      <HostCharacterAvatar config={config.character_2} className={secondActive ? "is-speaking" : ""} />
    </div>
    <div className="host-dialogue">{dialogue}</div>
    {onContinue && <button className="host-intervention-cta" type="button" onClick={onContinue}>Continuar</button>}
  </div>;
}
