import { captainHairOptions } from "@/lib/captainsHair";
import { useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import HostCharacterAvatar from "./HostCharacterAvatar";
import CaptainOutfitEditor from "./CaptainOutfitEditor";
import HostPhotoEditor from "./HostPhotoEditor";
import { getHostSpriteConfig } from "@/lib/captainsHosts";
import HostIntervention from "./HostIntervention";
import { getHostMessageFromCatalog } from "@/lib/captainsHostMessages";
import type { CaptainsHostCharacterConfig, CaptainsHostConfig, CaptainsHostFrequency, CaptainsHostTone, CaptainsHostTrigger } from "@/lib/captainsTypes";

const toneOptions: Array<{ value: CaptainsHostTone; label: string }> = [
  { value: "divertido", label: "Divertido" }, { value: "elegante", label: "Elegante" }, { value: "gamberro", label: "Gamberro" }, { value: "epico", label: "Épico" }, { value: "romantico", label: "Romántico" },
];
const frequencyOptions: Array<{ value: CaptainsHostFrequency; label: string; detail: string }> = [
  { value: "low", label: "Baja", detail: "Hasta 8 situaciones · pausa de 5 min" }, { value: "normal", label: "Normal", detail: "Hasta 13 situaciones · pausa de 4 min" }, { value: "high", label: "Alta", detail: "Hasta 15 situaciones · pausa de 3 min" },
];
const previewTriggers: Array<{ value: CaptainsHostTrigger; label: string }> = [
  { value: "GAME_STARTED", label: "Inicio" }, { value: "POINTS_50", label: "50 puntos" }, { value: "HALFWAY_CHALLENGES", label: "Mitad de retos" }, { value: "ENTERED_PODIUM", label: "Podio" }, { value: "LAST_CHALLENGE", label: "Último reto" }, { value: "GAME_FINISHED", label: "Final" },
];

const choice = <T extends string>(label: string, values: Array<{ value: T; label: string }>, current: T, onChange: (value: T) => void) => <fieldset className="space-y-2"><legend className="text-xs font-medium text-muted-foreground">{label}</legend><div className="flex flex-wrap gap-2">{values.map(item => <button type="button" key={item.value} aria-pressed={current === item.value} onClick={() => onChange(item.value)} className={`rounded-full border px-3 py-2 text-xs transition ${current === item.value ? "border-[#f06a5f] bg-[#f06a5f]/10 text-[#b94d45]" : "border-border bg-background"}`}>{item.label}</button>)}</div></fieldset>;

function CharacterEditor({ number, config, partnerName, onChange }: { number: 1 | 2; config: CaptainsHostCharacterConfig; partnerName: string; onChange: (next: CaptainsHostCharacterConfig) => void }) {
  const patch = (next: Partial<CaptainsHostCharacterConfig>) => onChange({ ...config, ...next });
  const sprite = getHostSpriteConfig(config);
  const patchSprite = (next: Partial<typeof sprite>) => patch({ sprite_config: { ...sprite, ...next } });
  return <div className="grid gap-5 rounded-2xl border border-border bg-background p-4 lg:grid-cols-[180px_1fr]">
    <div className="mx-auto w-40"><HostCharacterAvatar config={config} /><p className="mt-2 text-center text-sm font-semibold">{config.display_name || partnerName || `Anfitrión ${number}`}</p></div>
    <div className="space-y-4">
      <label className="block space-y-1"><span className="text-xs font-medium text-muted-foreground">Nombre que mostrará</span><Input value={config.display_name} placeholder={partnerName || "Opcional"} onChange={event => patch({ display_name: event.target.value })}/></label>
      <HostPhotoEditor photoUrl={config.photo_url} onChange={photo_url => patch({ photo_url })} />
      {choice("Personaje", [{ value: "male", label: "Hombre" }, { value: "female", label: "Mujer" }, { value: "unspecified", label: "Sin especificar" }], sprite.sex, sex => patchSprite({ sex }))}
      {choice("Tono de piel", [{value:"very_fair",label:"Muy claro"},{value:"fair",label:"Claro"},{value:"tan",label:"Moreno"},{value:"dark",label:"Oscuro"}], sprite.skin_color, skin_color => patchSprite({ skin_color }))}
      {choice("Pelo", captainHairOptions, sprite.hair_length, hair_length => patchSprite({ hair_length }))}
      {choice("Color de pelo", [{value:"blonde",label:"Rubio"},{value:"brown",label:"Castaño"},{value:"dark",label:"Oscuro"}], sprite.hair_color, hair_color => patchSprite({ hair_color }))}
      <div className="grid gap-3 sm:grid-cols-2"><CaptainOutfitEditor config={sprite} onChange={patchSprite} /></div>
    </div>
  </div>;
}

export default function CaptainsPersonalizationEditor({ value, onChange }: { value: CaptainsHostConfig; onChange: (next: CaptainsHostConfig) => void }) {
  const [previewTrigger, setPreviewTrigger] = useState<CaptainsHostTrigger>("POINTS_50");
  const wedding = value.wedding;
  const patchWedding = (patch: Partial<typeof wedding>) => onChange({ ...value, wedding: { ...wedding, ...patch } });
  const context = useMemo(() => ({ teamName: "Mesa 4", teamNumber: 4, points: previewTrigger === "GAME_FINISHED" ? 125 : 50, partner1: wedding.partner_1_nickname || wedding.partner_1_name, partner2: wedding.partner_2_nickname || wedding.partner_2_name, yearsTogether: wedding.years_together, venue: wedding.venue_name, city: wedding.venue_city, otherTeam: "Mesa 6" }), [previewTrigger, wedding]);
  const preview = getHostMessageFromCatalog(previewTrigger, value.tone, 0, context);
  return <section className="space-y-4 rounded-2xl border border-[#f06a5f]/25 bg-[#f06a5f]/[.035] p-4 md:col-span-2" aria-labelledby="captains-personalization-title">
    <div className="flex items-start justify-between gap-4"><div><h2 id="captains-personalization-title" className="font-semibold">Personalización del juego</h2><p className="mt-1 text-xs text-muted-foreground">Los anfitriones aparecerán brevemente en los momentos importantes de la partida.</p></div><Switch checked={value.enabled} onCheckedChange={enabled => onChange({ ...value, enabled })} aria-label="Mostrar anfitriones durante el juego" /></div>
    <Accordion type="multiple" defaultValue={["couple"]} className="space-y-2">
      <AccordionItem value="couple" className="rounded-xl border bg-background px-4"><AccordionTrigger>1. Los novios</AccordionTrigger><AccordionContent className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1"><span className="text-xs">Nombre persona 1</span><Input value={wedding.partner_1_name} onChange={event => patchWedding({ partner_1_name: event.target.value })}/></label><label className="space-y-1"><span className="text-xs">Apodo persona 1</span><Input value={wedding.partner_1_nickname} onChange={event => patchWedding({ partner_1_nickname: event.target.value })}/></label>
        <label className="space-y-1"><span className="text-xs">Nombre persona 2</span><Input value={wedding.partner_2_name} onChange={event => patchWedding({ partner_2_name: event.target.value })}/></label><label className="space-y-1"><span className="text-xs">Apodo persona 2</span><Input value={wedding.partner_2_nickname} onChange={event => patchWedding({ partner_2_nickname: event.target.value })}/></label>
        <label className="space-y-1"><span className="text-xs">Años juntos</span><Input type="number" min="0" value={wedding.years_together ?? ""} onChange={event => patchWedding({ years_together: event.target.value === "" ? null : Number(event.target.value) })}/></label><label className="space-y-1"><span className="text-xs">Fecha de inicio de la relación</span><Input type="date" value={wedding.relationship_start_date} onChange={event => { const date = event.target.value; const years = date ? Math.max(0, new Date().getFullYear() - new Date(date).getFullYear() - (new Date() < new Date(`${new Date().getFullYear()}-${date.slice(5)}`) ? 1 : 0)) : wedding.years_together; patchWedding({ relationship_start_date: date, years_together: years }); }}/></label>
      </AccordionContent></AccordionItem>
      <AccordionItem value="wedding" className="rounded-xl border bg-background px-4"><AccordionTrigger>2. La boda</AccordionTrigger><AccordionContent className="grid gap-3 md:grid-cols-2">
        {[['venue_name','Nombre del lugar'],['venue_city','Ciudad'],['venue_region','Provincia o región'],['venue_country','País'],['venue_address','Dirección (opcional)'],['city_where_they_live','Ciudad donde viven']].map(([key,label]) => <label className="space-y-1" key={key}><span className="text-xs">{label}</span><Input value={String(wedding[key as keyof typeof wedding] ?? "")} onChange={event => patchWedding({ [key]: event.target.value })}/></label>)}
        <label className="space-y-1 md:col-span-2"><span className="text-xs">Cómo se conocieron</span><Textarea rows={2} value={wedding.how_they_met} onChange={event => patchWedding({ how_they_met: event.target.value })}/></label>
        {[['met_location','Lugar donde se conocieron'],['shared_hobby','Afición compartida'],['special_song','Canción especial'],['inside_phrase','Frase interna'],['most_competitive_partner','Persona más competitiva'],['fun_fact','Dato curioso']].map(([key,label]) => <label className="space-y-1" key={key}><span className="text-xs">{label}</span><Input value={String(wedding[key as keyof typeof wedding] ?? "")} onChange={event => patchWedding({ [key]: event.target.value })}/></label>)}
      </AccordionContent></AccordionItem>
      <AccordionItem value="characters" className="rounded-xl border bg-background px-4"><AccordionTrigger>3. Los personajes</AccordionTrigger><AccordionContent className="space-y-4"><p className="text-xs text-muted-foreground">Personaliza a los novios igual que a los capitanes. Puedes usar una foto como cabeza y elegir su vestuario y colores.</p><CharacterEditor number={1} config={value.character_1} partnerName={wedding.partner_1_name} onChange={character_1 => onChange({ ...value, character_1 })}/><CharacterEditor number={2} config={value.character_2} partnerName={wedding.partner_2_name} onChange={character_2 => onChange({ ...value, character_2 })}/></AccordionContent></AccordionItem>
      <AccordionItem value="personality" className="rounded-xl border bg-background px-4"><AccordionTrigger>4. Personalidad del juego</AccordionTrigger><AccordionContent className="space-y-5">{choice("Tono de los mensajes", toneOptions, value.tone, tone => onChange({ ...value, tone }))}<fieldset className="space-y-2"><legend className="text-xs font-medium text-muted-foreground">Frecuencia de apariciones</legend><div className="grid gap-2 sm:grid-cols-3">{frequencyOptions.map(item => { const selected = value.frequency === item.value; return <label key={item.value} className={`relative block cursor-pointer rounded-xl border p-3 text-left transition focus-within:ring-2 focus-within:ring-[#f06a5f] focus-within:ring-offset-2 ${selected ? "border-[#f06a5f] bg-[#f06a5f]/10 text-[#8f3d36]" : "border-border bg-background hover:bg-muted/50"}`}><input className="sr-only" type="radio" name="captains-host-frequency" value={item.value} checked={selected} onChange={() => onChange({ ...value, frequency: item.value })}/><span className="flex items-center justify-between gap-2"><strong className="block text-sm">{item.label}</strong><span aria-hidden="true" className={`h-4 w-4 rounded-full border ${selected ? "border-[#f06a5f] bg-[#f06a5f] shadow-[inset_0_0_0_3px_white]" : "border-border bg-background"}`}/></span><span className="text-xs text-muted-foreground">{item.detail}</span></label>; })}</div></fieldset></AccordionContent></AccordionItem>
      <AccordionItem value="preview" className="rounded-xl border bg-background px-4"><AccordionTrigger>5. Previsualización</AccordionTrigger><AccordionContent><div className="mb-3 flex flex-wrap gap-2">{previewTriggers.map(item => <button type="button" key={item.value} onClick={() => setPreviewTrigger(item.value)} className={`rounded-full border px-3 py-2 text-xs ${previewTrigger === item.value ? "border-[#f06a5f] bg-[#f06a5f]/10" : ""}`}>{item.label}</button>)}</div><HostIntervention config={value} message={preview} preview /></AccordionContent></AccordionItem>
    </Accordion>
  </section>;
}
