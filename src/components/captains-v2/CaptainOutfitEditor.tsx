import { Input } from "@/components/ui/input";
import { captainsOutfits, getCaptainOutfit } from "@/lib/captainsOutfits";
import type { CaptainsSpriteConfig, CaptainsSpriteOutfitType } from "@/lib/captainsTypes";

export default function CaptainOutfitEditor({ config, onChange }: {
  config?: CaptainsSpriteConfig | null;
  onChange: (patch: Partial<CaptainsSpriteConfig>) => void;
}) {
  const outfit = getCaptainOutfit(config?.outfit_type);
  const options = captainsOutfits.filter(item => item.sexes.includes(config?.sex || "unspecified") || item.value === outfit.value);
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
  </>;
}
