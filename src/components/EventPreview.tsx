import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFontById, loadGoogleFont, getEventFontFamily, EventFontFamily } from "@/lib/eventFonts";
import { FilterType, FILTER_LABELS, getFilterClass } from "@/lib/photoFilters";
import cameraIcon from "@/assets/camera.png";
import prohibidoIcon from "@/assets/prohibido.png";
import { Image, Play } from "lucide-react";

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
  
  // Map font size to smaller preview sizes
  const previewFontSizeMap: Record<string, string> = {
    "text-xl": "text-sm",
    "text-2xl": "text-base",
    "text-3xl": "text-lg",
    "text-4xl": "text-xl",
    "text-5xl": "text-2xl",
  };
  const previewFontSize = previewFontSizeMap[fontSize] || "text-lg";

  const renderNotStartedPreview = () => (
    <div className="flex flex-col h-full bg-background">
      {backgroundImageUrl ? (
        <>
          {/* Hero with background */}
          <div className="relative h-24 w-full">
            <img
              src={backgroundImageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          </div>
          <div className="relative -mt-6 px-3 text-center">
            <h2 
              className={`${previewFontSize} font-bold tracking-tight text-foreground leading-tight`}
              style={{ fontFamily: fontStyle }}
            >
              {eventName || "Nombre del evento"}
            </h2>
            {description && (
              <p className="text-[8px] text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2">{description}</p>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between p-2 border-b border-border">
          <span className={`${previewFontSize} font-bold text-foreground truncate`} style={{ fontFamily: fontStyle }}>
            {eventName || "Evento"}
          </span>
        </div>
      )}
      
      <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
        <img
          src={prohibidoIcon}
          alt=""
          className="w-12 h-12 object-contain mb-2"
        />
        <p className="text-[10px] font-semibold text-foreground mb-1">Evento no iniciado</p>
        <p className="text-[8px] text-muted-foreground mb-2">El período de subida aún no ha comenzado</p>
        <div className="bg-card border border-border rounded px-2 py-1.5">
          <p className="text-[7px] text-muted-foreground">Comenzará el</p>
          <p className="text-[9px] font-bold text-foreground">15 Enero a las 18:00</p>
        </div>
        <p className="text-[9px] text-primary font-medium mt-2">Faltan 2h 30min</p>
        {customImageUrl && (
          <img src={customImageUrl} alt="" className="mt-auto max-w-[80px] max-h-[30px] object-contain" />
        )}
      </div>
    </div>
  );

  const renderActivePreview = () => (
    <div className="flex flex-col h-full bg-background">
      {backgroundImageUrl ? (
        <>
          {/* Hero with background */}
          <div className="relative h-24 w-full">
            <img
              src={backgroundImageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          </div>
          <div className="relative -mt-6 px-3 text-center">
            <h2 
              className={`${previewFontSize} font-bold tracking-tight text-foreground leading-tight`}
              style={{ fontFamily: fontStyle }}
            >
              {eventName || "Nombre del evento"}
            </h2>
            {description && (
              <p className="text-[8px] text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2">{description}</p>
            )}
            <p className="text-[8px] text-muted-foreground flex items-center justify-center gap-0.5 mt-1">
              <Image className="w-2.5 h-2.5" />
              12 fotos subidas
            </p>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between p-2 border-b border-border">
          <div>
            <span className={`${previewFontSize} font-bold text-foreground`} style={{ fontFamily: fontStyle }}>
              {eventName || "Evento"}
            </span>
            <p className="text-[7px] text-muted-foreground flex items-center gap-0.5">
              <Image className="w-2 h-2" />
              12 fotos subidas
            </p>
          </div>
        </div>
      )}
      
      <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
        <button className="bg-primary hover:bg-primary/90 text-primary-foreground text-[9px] font-semibold px-4 py-2 rounded-lg mb-3">
          Hacer foto
        </button>
        <div className="bg-card border border-border rounded px-2 py-1.5 mb-2">
          <p className="text-[8px] text-primary font-medium">
            Quedan 5h 45min para subir fotos
          </p>
        </div>
        <p className="text-[7px] text-muted-foreground">
          Mañana a las 12:00 se revelarán las fotos
        </p>
        {customImageUrl && (
          <img src={customImageUrl} alt="" className="mt-auto max-w-[80px] max-h-[30px] object-contain" />
        )}
      </div>
    </div>
  );

  const renderEndedPreview = () => (
    <div className="flex flex-col h-full bg-background">
      {backgroundImageUrl ? (
        <>
          <div className="relative h-24 w-full">
            <img
              src={backgroundImageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          </div>
          <div className="relative -mt-6 px-3 text-center">
            <h2 
              className={`${previewFontSize} font-bold tracking-tight text-foreground leading-tight`}
              style={{ fontFamily: fontStyle }}
            >
              {eventName || "Nombre del evento"}
            </h2>
            {description && (
              <p className="text-[8px] text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2">{description}</p>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between p-2 border-b border-border">
          <span className={`${previewFontSize} font-bold text-foreground`} style={{ fontFamily: fontStyle }}>
            {eventName || "Evento"}
          </span>
        </div>
      )}
      
      <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
        <img
          src={prohibidoIcon}
          alt=""
          className="w-12 h-12 object-contain mb-2"
        />
        <p className="text-[10px] font-semibold text-foreground mb-1">Evento finalizado</p>
        <p className="text-[8px] text-muted-foreground mb-2">Ya no se pueden subir más fotos</p>
        <div className="bg-card border border-border rounded px-2 py-1.5">
          <p className="text-[9px] text-primary font-medium">
            Faltan 3h 15min para el revelado
          </p>
        </div>
        <p className="text-[8px] text-muted-foreground mt-2">¡Qué nervios! 📸✨</p>
        {customImageUrl && (
          <img src={customImageUrl} alt="" className="mt-auto max-w-[80px] max-h-[30px] object-contain" />
        )}
      </div>
    </div>
  );

  const renderRevealedPreview = () => (
    <div className="flex flex-col h-full bg-background">
      {backgroundImageUrl ? (
        <>
          {/* Hero Header with background */}
          <div className="relative h-28 w-full">
            <img
              src={backgroundImageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          </div>
          <div className="relative -mt-8 px-3 text-center">
            <h2 
              className={`${previewFontSize} font-bold tracking-tight text-foreground leading-tight`}
              style={{ fontFamily: fontStyle }}
            >
              {eventName || "Nombre del evento"}
            </h2>
            {description && (
              <p className="text-[8px] text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2">{description}</p>
            )}
            {customImageUrl && (
              <img src={customImageUrl} alt="" className="mx-auto mt-1 max-w-[60px] max-h-[20px] object-contain" />
            )}
            <p className="text-[8px] text-muted-foreground mt-1">
              ✨ Se han revelado 24 fotos
            </p>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between p-2 border-b border-border">
          <div>
            <span className={`${previewFontSize} font-bold text-foreground`} style={{ fontFamily: fontStyle }}>
              {eventName || "Evento"}
            </span>
            {description && (
              <p className="text-[7px] text-muted-foreground line-clamp-1">{description}</p>
            )}
            {customImageUrl && (
              <img src={customImageUrl} alt="" className="mt-0.5 max-w-[50px] max-h-[18px] object-contain" />
            )}
            <p className="text-[7px] text-muted-foreground mt-0.5">✨ Se han revelado 24 fotos</p>
          </div>
        </div>
      )}
      
      {/* Photo Grid Preview */}
      <div className="flex-1 p-2 overflow-hidden">
        <div className="grid grid-cols-3 gap-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div 
              key={i} 
              className={`aspect-square bg-muted rounded overflow-hidden ${getFilterClass(filterType)}`}
            >
              <div className="w-full h-full bg-gradient-to-br from-muted-foreground/30 to-muted-foreground/10" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Stories Button */}
      <div className="absolute bottom-3 right-3">
        <div className="w-8 h-8 rounded-full bg-[#FF6565] shadow flex items-center justify-center">
          <Play className="w-3.5 h-3.5 text-white fill-white" />
        </div>
      </div>
    </div>
  );

  const renderExpiredPreview = () => (
    <div className="flex flex-col items-center justify-center h-full bg-background p-4 text-center">
      <h2 
        className={`${previewFontSize} font-bold text-foreground mb-3`}
        style={{ fontFamily: fontStyle }}
      >
        {eventName || "Nombre del evento"}
      </h2>
      <p className="text-[9px] text-muted-foreground mb-4">
        Las fotografías están disponibles en el siguiente enlace
      </p>
      <button className="bg-primary text-primary-foreground text-[9px] font-medium px-4 py-2 rounded-md">
        Ver fotografías
      </button>
      {customImageUrl && (
        <img src={customImageUrl} alt="" className="mt-auto max-w-[80px] max-h-[30px] object-contain" />
      )}
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
        <div className="relative w-[180px] h-[360px] bg-foreground rounded-[24px] p-1.5 shadow-lg">
          {/* Notch */}
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-12 h-3 bg-foreground rounded-b-lg z-20" />
          
          {/* Screen */}
          <div className="w-full h-full bg-background rounded-[20px] overflow-hidden relative">
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
