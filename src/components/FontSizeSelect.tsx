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

export const FontSizeSelect = ({ value, onChange }: FontSizeSelectProps) => {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {FONT_SIZE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "w-full px-2 py-2 text-xs sm:text-sm rounded-md border transition-colors",
              value === option.value
                ? "!border-foreground !bg-foreground !text-background shadow-sm"
                : "bg-muted border-border hover:bg-muted/80"
            )}
            title={option.description}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FontSizeSelect;
