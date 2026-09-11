import { captainHairOptions, captainHairColorOptions } from "@/lib/captainsHair";
import { Input } from "@/components/ui/input";
import HostCharacterAvatar from "./HostCharacterAvatar";
import CaptainOutfitEditor from "./CaptainOutfitEditor";
import HostPhotoEditor from "./HostPhotoEditor";
import { getHostSpriteConfig } from "@/lib/captainsHosts";
import type { CaptainsHostCharacterConfig, CaptainsHostConfig, CaptainsWeddingContext } from "@/lib/captainsTypes";

const choice = <T extends string>(label: string, values: Array<{ value: T; label: string }>, current: T, onChange: (value: T) => void) => <fieldset className="space-y-2"><legend className="text-xs font-medium text-muted-foreground">{label}</legend><div className="flex flex-wrap gap-2">{values.map(item => <button type="button" key={item.value} aria-pressed={current === item.value} onClick={() => onChange(item.value)} className={`rounded-full border px-3 py-2 text-xs transition ${current === item.value ? "border-[#f06a5f] bg-[#f06a5f]/10 text-[#b94d45]" : "border-border bg-background"}`}>{item.label}</button>)}</div></fieldset>;

function CharacterEditor({ number, config, name, nickname, onWeddingChange, onChange }: { number: 1 | 2; config: CaptainsHostCharacterConfig; name: string; nickname: string; onWeddingChange: (patch: Partial<CaptainsWeddingContext>) => void; onChange: (next: CaptainsHostCharacterConfig) => void }) {
  const patch = (next: Partial<CaptainsHostCharacterConfig>) => onChange({ ...config, ...next });
  const sprite = getHostSpriteConfig(config);
  const patchSprite = (next: Partial<typeof sprite>) => patch({ sprite_config: { ...sprite, ...next } });
  const nameKey = number === 1 ? "partner_1_name" : "partner_2_name";
  const nicknameKey = number === 1 ? "partner_1_nickname" : "partner_2_nickname";
  return <section className="grid gap-5 rounded-2xl border border-border bg-background p-4 lg:grid-cols-[180px_1fr]">
    <div className="mx-auto w-40"><HostCharacterAvatar config={config} /><p className="mt-2 text-center text-sm font-semibold">{nickname || name || `Novio ${number}`}</p></div>
    <div className="space-y-4">
      <div><h3 className="font-semibold">Información del novio {number}</h3><p className="text-xs text-muted-foreground">Nombre, apodo y aspecto del personaje.</p></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">Nombre</span><Input value={name} onChange={event => onWeddingChange({ [nameKey]: event.target.value })}/></label><label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">Apodo</span><Input value={nickname} placeholder="Opcional" onChange={event => onWeddingChange({ [nicknameKey]: event.target.value })}/></label></div>
      <HostPhotoEditor photoUrl={config.photo_url} onChange={photo_url => patch({ photo_url })} />
      {choice("Personaje", [{ value: "male", label: "Hombre" }, { value: "female", label: "Mujer" }, { value: "unspecified", label: "Sin especificar" }], sprite.sex, sex => patchSprite({ sex }))}
      {choice("Tono de piel", [{value:"very_fair",label:"Muy claro"},{value:"fair",label:"Claro"},{value:"tan",label:"Moreno"},{value:"dark",label:"Oscuro"}], sprite.skin_color, skin_color => patchSprite({ skin_color }))}
      {choice("Pelo", captainHairOptions, sprite.hair_length, hair_length => patchSprite({ hair_length }))}
      {choice("Color de pelo", [...captainHairColorOptions], sprite.hair_color, hair_color => patchSprite({ hair_color }))}
      <div className="grid gap-3 sm:grid-cols-2"><CaptainOutfitEditor config={sprite} onChange={patchSprite} /></div>
    </div>
  </section>;
}

export default function CaptainsPersonalizationEditor({ value, onChange }: { value: CaptainsHostConfig; onChange: (next: CaptainsHostConfig) => void }) {
  const wedding = value.wedding;
  const emit = (next: CaptainsHostConfig) => onChange({ ...next, enabled: true, tone: "divertido", frequency: "high" });
  const patchWedding = (patch: Partial<typeof wedding>) => emit({ ...value, wedding: { ...wedding, ...patch } });
  return <section className="space-y-5 rounded-2xl border border-[#f06a5f]/25 bg-[#f06a5f]/[.035] p-4 md:col-span-2" aria-labelledby="captains-personalization-title">
    <div><h2 id="captains-personalization-title" className="text-lg font-semibold">Datos de la boda y los novios</h2><p className="mt-1 text-xs text-muted-foreground">Estos datos personalizan los comentarios divertidos que aparecerán durante el juego.</p></div>
    <section className="rounded-2xl border border-border bg-background p-4"><h3 className="font-semibold">Datos generales de la boda</h3><p className="mt-1 text-xs text-muted-foreground">Solo pedimos la información que se utiliza en los comentarios de los novios.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">Años juntos</span><Input type="number" min="0" value={wedding.years_together ?? ""} onChange={event => patchWedding({ years_together: event.target.value === "" ? null : Number(event.target.value) })}/></label><label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">Lugar de celebración</span><Input value={wedding.venue_name} placeholder="Finca, restaurante, hotel..." onChange={event => patchWedding({ venue_name: event.target.value })}/></label></div></section>
    <CharacterEditor number={1} config={value.character_1} name={wedding.partner_1_name} nickname={wedding.partner_1_nickname} onWeddingChange={patchWedding} onChange={character_1 => emit({ ...value, character_1 })}/>
    <CharacterEditor number={2} config={value.character_2} name={wedding.partner_2_name} nickname={wedding.partner_2_nickname} onWeddingChange={patchWedding} onChange={character_2 => emit({ ...value, character_2 })}/>
  </section>;
}
