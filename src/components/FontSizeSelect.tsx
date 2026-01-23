import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FontSizeOption = "text-xl" | "text-2xl" | "text-3xl" | "text-4xl" | "text-5xl";

interface FontSizeSelectProps {
  value: FontSizeOption;
  onChange: (size: FontSizeOption) => void;
  previewText?: string;
  fontFamily?: string;
}

const FONT_SIZE_OPTIONS: { value: FontSizeOption; label: string; description: string }[] = [
  { value: "text-xl", label: "XS", description: "Muy pequeño" },
  { value: "text-2xl", label: "S", description: "Pequeño" },
  { value: "text-3xl", label: "M", description: "Mediano" },
  { value: "text-4xl", label: "L", description: "Grande" },
  { value: "text-5xl", label: "XL", description: "Muy grande" },
];

export const FontSizeSelect = ({ value, onChange, previewText = "Evento", fontFamily }: FontSizeSelectProps) => {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {FONT_SIZE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 px-2 py-2 text-sm rounded-md border transition-colors",
              value === option.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted border-border hover:bg-muted/80"
            )}
            title={option.description}
          >
            {option.label}
          </button>
        ))}
      </div>
      
      {/* Preview */}
      <div className="p-4 border border-border rounded-lg bg-muted/50 overflow-hidden">
        <p 
          className={cn(value, "font-bold text-foreground text-center truncate")}
          style={{ fontFamily: fontFamily || "inherit" }}
        >
          {previewText || "Evento"}
        </p>
      </div>
    </div>
  );
};

export default FontSizeSelect;
