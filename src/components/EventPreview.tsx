import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFontById, loadGoogleFont, getEventFontFamily, EventFontFamily } from "@/lib/eventFonts";
import { FilterType, FILTER_LABELS } from "@/lib/photoFilters";
import cameraIcon from "@/assets/camera.png";
import prohibidoIcon from "@/assets/prohibido.png";

type PreviewState = "not_started" | "active" | "ended" | "revealed" | "expired";

interface EventPreviewProps {
  eventName: string;
  description?: string;
  fontFamily: EventFontFamily;
  fontSize: string;
  backgroundImageUrl?: string;
  customImageUrl?: string;
  filterType: FilterType;
  language?: string;
}

const STATE_LABELS: Record<PreviewState, string> = {
  not_started: "No iniciado",
  active: "En curso",
  ended: "Finalizado",
  revealed: "Revelado",
  expired: "Caducado",
};

const FONT_SIZE_CLASSES: Record<string, string> = {
  "text-xl": "text-xl",
  "text-2xl": "text-2xl",
  "text-3xl": "text-3xl",
  "text-4xl": "text-4xl",
  "text-5xl": "text-5xl",
};

export const EventPreview = ({
  eventName,
  description,
  fontFamily,
  fontSize,
  backgroundImageUrl,
  customImageUrl,
  filterType,
  language = "es",
}: EventPreviewProps) => {
  const [previewState, setPreviewState] = useState<PreviewState>("active");

  // Load font
  if (fontFamily && fontFamily !== "system") {
    const font = getFontById(fontFamily);
    loadGoogleFont(font);
  }

  const fontStyle = getEventFontFamily(fontFamily);
  const sizeClass = FONT_SIZE_CLASSES[fontSize] || "text-3xl";

  const renderNotStartedPreview = () => (
    <div className="flex flex-col items-center justify-center h-full bg-background p-4">
      {backgroundImageUrl && (
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={backgroundImageUrl}
            alt=""
            className="w-full h-32 object-cover"
          />
          <div className="absolute inset-0 bg-white/85 h-32" />
        </div>
      )}
      <div className="relative z-10 flex flex-col items-center text-center">
        <img src={prohibidoIcon} alt="" className="w-16 h-16 mb-4 opacity-60" />
        <h2 className={`${sizeClass} font-bold text-foreground mb-2`} style={{ fontFamily: fontStyle }}>
          {eventName || "Nombre del evento"}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground mb-4 whitespace-pre-line max-w-[90%]">
            {description}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          El evento aún no ha empezado
        </p>
        <p className="text-xs text-primary font-medium mt-2">
          Faltan 2h 30min
        </p>
        {customImageUrl && (
          <img src={customImageUrl} alt="" className="mt-4 max-w-[120px] max-h-[50px] object-contain" />
        )}
      </div>
    </div>
  );

  const renderActivePreview = () => (
    <div className="flex flex-col items-center justify-center h-full bg-background p-4">
      {backgroundImageUrl && (
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={backgroundImageUrl}
            alt=""
            className="w-full h-32 object-cover"
          />
          <div className="absolute inset-0 bg-white/85 h-32" />
        </div>
      )}
      <div className="relative z-10 flex flex-col items-center text-center">
        <h2 className={`${sizeClass} font-bold text-foreground mb-2`} style={{ fontFamily: fontStyle }}>
          {eventName || "Nombre del evento"}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground mb-4 whitespace-pre-line max-w-[90%]">
            {description}
          </p>
        )}
        <button className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors mb-4">
          <img src={customImageUrl || cameraIcon} alt="" className="w-12 h-12 object-contain" />
        </button>
        <p className="text-xs text-muted-foreground">
          Haz click para hacer una foto
        </p>
        <p className="text-xs text-primary font-medium mt-2">
          Quedan 5h 45min para subir fotos
        </p>
      </div>
    </div>
  );

  const renderEndedPreview = () => (
    <div className="flex flex-col items-center justify-center h-full bg-background p-4">
      {backgroundImageUrl && (
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={backgroundImageUrl}
            alt=""
            className="w-full h-32 object-cover"
          />
          <div className="absolute inset-0 bg-white/85 h-32" />
        </div>
      )}
      <div className="relative z-10 flex flex-col items-center text-center">
        <img src={prohibidoIcon} alt="" className="w-16 h-16 mb-4 opacity-60" />
        <h2 className={`${sizeClass} font-bold text-foreground mb-2`} style={{ fontFamily: fontStyle }}>
          {eventName || "Nombre del evento"}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground mb-4 whitespace-pre-line max-w-[90%]">
            {description}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          El evento ha finalizado
        </p>
        <p className="text-xs text-primary font-medium mt-2">
          Faltan 3h 15min para el revelado
        </p>
        {customImageUrl && (
          <img src={customImageUrl} alt="" className="mt-4 max-w-[120px] max-h-[50px] object-contain" />
        )}
      </div>
    </div>
  );

  const renderRevealedPreview = () => (
    <div className="flex flex-col h-full bg-background">
      {/* Hero Header */}
      <div className="relative h-28 overflow-hidden">
        {backgroundImageUrl ? (
          <>
            <img
              src={backgroundImageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-white/85" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-primary/20 to-background" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
          <h2 className={`${sizeClass} font-bold text-foreground leading-tight`} style={{ fontFamily: fontStyle }}>
            {eventName || "Nombre del evento"}
          </h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line max-w-[90%] line-clamp-2">
              {description}
            </p>
          )}
          {customImageUrl && (
            <img src={customImageUrl} alt="" className="mt-2 max-w-[80px] max-h-[30px] object-contain" />
          )}
        </div>
      </div>
      
      {/* Photo Grid Preview */}
      <div className="flex-1 p-2 overflow-hidden">
        <p className="text-xs text-center text-primary font-medium mb-2">
          ✨ Se han revelado 24 fotos
        </p>
        <div className="grid grid-cols-3 gap-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div 
              key={i} 
              className={`aspect-square bg-muted rounded overflow-hidden ${
                filterType === "vintage" ? "sepia brightness-95" :
                filterType === "35mm" ? "contrast-110 saturate-90" : ""
              }`}
            >
              <div className="w-full h-full bg-gradient-to-br from-muted-foreground/20 to-muted-foreground/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderExpiredPreview = () => (
    <div className="flex flex-col items-center justify-center h-full bg-background p-4">
      <div className="flex flex-col items-center text-center">
        <h2 className={`${sizeClass} font-bold text-foreground mb-4`} style={{ fontFamily: fontStyle }}>
          {eventName || "Nombre del evento"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Este evento ha caducado
        </p>
        <button className="px-4 py-2 bg-primary text-primary-foreground text-xs rounded-md">
          Ver fotografías
        </button>
        {customImageUrl && (
          <img src={customImageUrl} alt="" className="mt-6 max-w-[120px] max-h-[50px] object-contain" />
        )}
      </div>
    </div>
  );

  const renderPreview = () => {
    switch (previewState) {
      case "not_started":
        return renderNotStartedPreview();
      case "active":
        return renderActivePreview();
      case "ended":
        return renderEndedPreview();
      case "revealed":
        return renderRevealedPreview();
      case "expired":
        return renderExpiredPreview();
      default:
        return renderActivePreview();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Vista previa</span>
        <Select value={previewState} onValueChange={(v) => setPreviewState(v as PreviewState)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Mobile Phone Frame */}
      <div className="flex justify-center">
        <div className="relative w-[200px] h-[400px] bg-foreground rounded-[24px] p-2 shadow-lg">
          {/* Notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-foreground rounded-b-lg z-20" />
          
          {/* Screen */}
          <div className="w-full h-full bg-background rounded-[18px] overflow-hidden relative">
            {renderPreview()}
          </div>
        </div>
      </div>
      
      <p className="text-xs text-center text-muted-foreground">
        Filtro: {FILTER_LABELS[filterType]}
      </p>
    </div>
  );
};

export default EventPreview;
