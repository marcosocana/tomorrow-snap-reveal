import { Input } from "@/components/ui/input";
import { captainsOutfits, getCaptainOutfit } from "@/lib/captainsOutfits";
import type { CaptainsSpriteConfig, CaptainsSpriteOutfitType } from "@/lib/captainsTypes";

export default function CaptainOutfitEditor({ config, onChange }: {
  config?: CaptainsSpriteConfig | null;
  onChange: (patch: Partial<CaptainsSpriteConfig>) => void;
}) {
  const outfit = getCaptainOutfit(config?.outfit_type);
  const options = captainsOutfits;
  return <>
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">Vestuario</span>
      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={outfit.value} onChange={event => onChange({ outfit_type: event.target.value as CaptainsSpriteOutfitType })}>
        {options.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </label>
    {outfit.colors.map(({ field, label, fallback }) => <label key={field} className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input type="color" value={/^#[0-9a-f]{6}$/i.test(config?.[field] || "") ? config![field] : fallback} onChange={event => onChange({ [field]: event.target.value })} className="h-10" />
    </label>)}
    {["suit", "tuxedo", "vest", "blazer"].includes(outfit.value) && <>
      <label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">Cuello</span><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={config?.neckwear ?? (outfit.value === "tuxedo" ? "bowtie" : outfit.value === "blazer" ? "none" : "tie")} onChange={event => onChange({ neckwear: event.target.value as CaptainsSpriteConfig["neckwear"] })}><option value="tie">Corbata</option><option value="bowtie">Pajarita</option><option value="none">Sin corbata</option></select></label>
      <label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">Color camisa interior</span><Input type="color" value={config?.shirt_color || "#fffaf4"} onChange={event => onChange({ shirt_color: event.target.value })} /></label>
    </>}
    <label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">Color zapatos</span><Input type="color" value={config?.shoe_color || (outfit.value === "casual" ? "#fffaf4" : "#332c2d")} onChange={event => onChange({ shoe_color: event.target.value })} /></label>
    <CaptainFaceEditor config={config} onChange={onChange} />
  </>;
}

function CaptainFaceEditor({ config, onChange }: { config?: CaptainsSpriteConfig | null; onChange: (patch: Partial<CaptainsSpriteConfig>) => void }) {
  const fields = [
    { key: "face_shape", label: "Forma de cara", fallback: "round", options: [["round", "Redonda"], ["oval", "Ovalada"], ["square", "Cuadrada"]] },
    { key: "expression", label: "Expresión", fallback: "smile", options: [["smile", "Sonrisa"], ["grin", "Sonrisa amplia"], ["wink", "Guiño"], ["calm", "Serena"]] },
    { key: "facial_hair", label: "Vello facial", fallback: "none", options: [["none", "Sin barba"], ["stubble", "Barba corta"], ["beard", "Barba completa"], ["mustache", "Bigote"]] },
    { key: "glasses", label: "Gafas", fallback: "none", options: [["none", "Sin gafas"], ["round", "Redondas"], ["square", "Rectangulares"], ["sun", "De sol"]] },
  ] as const;
  return <fieldset className="col-span-full grid gap-3 sm:grid-cols-2"><legend className="mb-3 text-sm font-semibold">Cara y detalles</legend>{fields.map(field => <label key={field.key} className="space-y-1"><span className="text-xs font-medium text-muted-foreground">{field.label}</span><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={config?.[field.key] || field.fallback} onChange={event => onChange({ [field.key]: event.target.value })}>{field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config?.freckles ?? false} onChange={event => onChange({ freckles: event.target.checked })} />Pecas</label></fieldset>;
}
