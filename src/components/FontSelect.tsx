import { useEffect } from "react";
import { FONT_OPTIONS, EventFontFamily, loadGoogleFont, getFontById } from "@/lib/eventFonts";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FontSelectProps {
  value: EventFontFamily;
  onChange: (fontFamily: EventFontFamily) => void;
  previewText?: string;
}

const FontSelect = ({ value, onChange, previewText = "Boda Ana & Luis" }: FontSelectProps) => {
  // Preload all fonts for preview
  useEffect(() => {
    FONT_OPTIONS.forEach(font => {
      if (font.googleFont) {
        loadGoogleFont(font);
      }
    });
  }, []);

  const selectedFont = getFontById(value);

  return (
    <div className="space-y-3">
      {/* Preview of selected font */}
      <div className="p-4 bg-muted rounded-lg border border-border">
        <p className="text-xs text-muted-foreground mb-2">Vista previa:</p>
        <p 
          className="text-2xl md:text-3xl text-foreground leading-tight"
          style={{ fontFamily: selectedFont.fontFamily }}
        >
          {previewText || "Nombre del evento"}
        </p>
      </div>

      {/* Font options grid */}
      <ScrollArea className="h-[280px] rounded-md border border-border">
        <div className="p-2 space-y-1">
          {/* System font */}
          <div className="mb-2">
            <p className="text-xs text-muted-foreground px-2 py-1">Sistema</p>
            {FONT_OPTIONS.filter(f => f.category === 'system').map((font) => (
              <button
                key={font.id}
                type="button"
                onClick={() => onChange(font.id)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  value === font.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <span 
                  className="text-lg"
                  style={{ fontFamily: font.fontFamily }}
                >
                  {font.name}
                </span>
              </button>
            ))}
          </div>

          {/* Calligraphic fonts */}
          <div className="mb-2">
            <p className="text-xs text-muted-foreground px-2 py-1">Caligráficas</p>
            {FONT_OPTIONS.filter(f => f.category === 'calligraphic').map((font) => (
              <button
                key={font.id}
                type="button"
                onClick={() => onChange(font.id)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  value === font.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <span 
                  className="text-lg"
                  style={{ fontFamily: font.fontFamily }}
                >
                  {font.name}
                </span>
              </button>
            ))}
          </div>

          {/* Decorative fonts */}
          <div>
            <p className="text-xs text-muted-foreground px-2 py-1">Decorativas</p>
            {FONT_OPTIONS.filter(f => f.category === 'decorative').map((font) => (
              <button
                key={font.id}
                type="button"
                onClick={() => onChange(font.id)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  value === font.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <span 
                  className="text-lg"
                  style={{ fontFamily: font.fontFamily }}
                >
                  {font.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default FontSelect;
