import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFontById, loadGoogleFont, getEventFontFamily, EventFontFamily } from "@/lib/eventFonts";
import { FilterType, getFilterClass } from "@/lib/photoFilters";
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

type PreviewTexts = {
  stateLabels: Record<PreviewState, string>;
  eventNamePlaceholder: string;
  eventNameShort: string;
  notStartedTitle: string;
  notStartedDesc: string;
  startsLabel: string;
  startsValue: string;
  countdown: string;
  photosUploaded: string;
  takePhoto: string;
  uploadCountdown: string;
  revealTomorrow: string;
  endedTitle: string;
  endedDesc: string;
  revealCountdown: string;
  endedNote: string;
  revealedInfo: string;
  expiredDesc: string;
  expiredButton: string;
  previewLabel: string;
  filterLabel: string;
  filters: Record<FilterType, string>;
};

const PREVIEW_TEXTS: Record<"es" | "en" | "it", PreviewTexts> = {
  es: {
    stateLabels: {
      not_started: "No iniciado",
      active: "En curso",
      ended: "Finalizado",
      revealed: "Revelado",
      expired: "Caducado",
    },
    eventNamePlaceholder: "Nombre del evento",
    eventNameShort: "Evento",
    notStartedTitle: "Evento no iniciado",
    notStartedDesc: "El período de subida aún no ha comenzado",
    startsLabel: "Comenzará el",
    startsValue: "15 Enero a las 18:00",
    countdown: "Faltan 2h 30min",
    photosUploaded: "12 fotos subidas",
    takePhoto: "Hacer foto",
    uploadCountdown: "Quedan 5h 45min para subir fotos",
    revealTomorrow: "Mañana a las 12:00 se revelarán las fotos",
    endedTitle: "Evento finalizado",
    endedDesc: "Ya no se pueden subir más fotos",
    revealCountdown: "Faltan 3h 15min para el revelado",
    endedNote: "¡Qué nervios! 📸✨",
    revealedInfo: "✨ Se han revelado 24 fotos",
    expiredDesc: "Las fotografías están disponibles en el siguiente enlace",
    expiredButton: "Ver fotografías",
    previewLabel: "Vista previa",
    filterLabel: "Filtro",
    filters: {
      none: "Sin filtros",
      vintage: "Vintage",
      "35mm": "35mm Film",
      sepia: "Sepia",
      bw: "Blanco y Negro",
      warm: "Cálido",
      cool: "Frío",
    },
  },
  en: {
    stateLabels: {
      not_started: "Not started",
      active: "Active",
      ended: "Ended",
      revealed: "Revealed",
      expired: "Expired",
    },
    eventNamePlaceholder: "Event name",
    eventNameShort: "Event",
    notStartedTitle: "Event not started",
    notStartedDesc: "The upload period hasn't started yet",
    startsLabel: "Starts on",
    startsValue: "Jan 15 at 18:00",
    countdown: "2h 30min remaining",
    photosUploaded: "12 photos uploaded",
    takePhoto: "Take photo",
    uploadCountdown: "5h 45min left to upload photos",
    revealTomorrow: "Tomorrow at 12:00 photos will be revealed",
    endedTitle: "Event ended",
    endedDesc: "No more photos can be uploaded",
    revealCountdown: "3h 15min until reveal",
    endedNote: "So exciting! 📸✨",
    revealedInfo: "✨ 24 photos revealed",
    expiredDesc: "Photos are available at the following link",
    expiredButton: "View photos",
    previewLabel: "Preview",
    filterLabel: "Filter",
    filters: {
      none: "No filters",
      vintage: "Vintage",
      "35mm": "35mm Film",
      sepia: "Sepia",
      bw: "Black & White",
      warm: "Warm",
      cool: "Cool",
    },
  },
  it: {
    stateLabels: {
      not_started: "Non iniziato",
      active: "In corso",
      ended: "Terminato",
      revealed: "Rivelato",
      expired: "Scaduto",
    },
    eventNamePlaceholder: "Nome evento",
    eventNameShort: "Evento",
    notStartedTitle: "Evento non iniziato",
    notStartedDesc: "Il periodo di caricamento non è ancora iniziato",
    startsLabel: "Inizia il",
    startsValue: "15 Gennaio alle 18:00",
    countdown: "Mancano 2h 30min",
    photosUploaded: "12 foto caricate",
    takePhoto: "Scatta foto",
    uploadCountdown: "Mancano 5h 45min per caricare foto",
    revealTomorrow: "Domani alle 12:00 le foto saranno rivelate",
    endedTitle: "Evento terminato",
    endedDesc: "Non è più possibile caricare foto",
    revealCountdown: "Mancano 3h 15min alla rivelazione",
    endedNote: "Che emozione! 📸✨",
    revealedInfo: "✨ 24 foto rivelate",
    expiredDesc: "Le foto sono disponibili al seguente link",
    expiredButton: "Vedi foto",
    previewLabel: "Anteprima",
    filterLabel: "Filtro",
    filters: {
      none: "Nessun filtro",
      vintage: "Vintage",
      "35mm": "35mm Film",
      sepia: "Sepia",
      bw: "Bianco e Nero",
      warm: "Caldo",
      cool: "Freddo",
    },
  },
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
  const previewTexts = PREVIEW_TEXTS[(language as "es" | "en" | "it")] ?? PREVIEW_TEXTS.es;

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
              {eventName || previewTexts.eventNamePlaceholder}
            </h2>
            {description && (
              <p className="text-[8px] text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2">{description}</p>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between p-2 border-b border-border">
          <span className={`${previewFontSize} font-bold text-foreground truncate`} style={{ fontFamily: fontStyle }}>
            {eventName || previewTexts.eventNameShort}
          </span>
        </div>
      )}
      
      <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
        <img
          src={prohibidoIcon}
          alt=""
          className="w-12 h-12 object-contain mb-2"
        />
        <p className="text-[10px] font-semibold text-foreground mb-1">{previewTexts.notStartedTitle}</p>
        <p className="text-[8px] text-muted-foreground mb-2">{previewTexts.notStartedDesc}</p>
        <div className="bg-card border border-border rounded px-2 py-1.5">
          <p className="text-[7px] text-muted-foreground">{previewTexts.startsLabel}</p>
          <p className="text-[9px] font-bold text-foreground">{previewTexts.startsValue}</p>
        </div>
        <p className="text-[9px] text-primary font-medium mt-2">{previewTexts.countdown}</p>
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
              {eventName || previewTexts.eventNamePlaceholder}
            </h2>
            {description && (
              <p className="text-[8px] text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2">{description}</p>
            )}
            <p className="text-[8px] text-muted-foreground flex items-center justify-center gap-0.5 mt-1">
              <Image className="w-2.5 h-2.5" />
              {previewTexts.photosUploaded}
            </p>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between p-2 border-b border-border">
          <div>
            <span className={`${previewFontSize} font-bold text-foreground`} style={{ fontFamily: fontStyle }}>
            {eventName || previewTexts.eventNameShort}
          </span>
          <p className="text-[7px] text-muted-foreground flex items-center gap-0.5">
            <Image className="w-2 h-2" />
            {previewTexts.photosUploaded}
          </p>
          </div>
        </div>
      )}
      
      <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
        <button className="bg-primary hover:bg-primary/90 text-primary-foreground text-[9px] font-semibold px-4 py-2 rounded-lg mb-3">
          {previewTexts.takePhoto}
        </button>
        <div className="bg-card border border-border rounded px-2 py-1.5 mb-2">
          <p className="text-[8px] text-primary font-medium">
            {previewTexts.uploadCountdown}
          </p>
        </div>
        <p className="text-[7px] text-muted-foreground">
          {previewTexts.revealTomorrow}
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
              {eventName || previewTexts.eventNamePlaceholder}
            </h2>
            {description && (
              <p className="text-[8px] text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2">{description}</p>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between p-2 border-b border-border">
          <span className={`${previewFontSize} font-bold text-foreground`} style={{ fontFamily: fontStyle }}>
            {eventName || previewTexts.eventNameShort}
          </span>
        </div>
      )}
      
      <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
        <img
          src={prohibidoIcon}
          alt=""
          className="w-12 h-12 object-contain mb-2"
        />
        <p className="text-[10px] font-semibold text-foreground mb-1">{previewTexts.endedTitle}</p>
        <p className="text-[8px] text-muted-foreground mb-2">{previewTexts.endedDesc}</p>
        <div className="bg-card border border-border rounded px-2 py-1.5">
          <p className="text-[9px] text-primary font-medium">
            {previewTexts.revealCountdown}
          </p>
        </div>
        <p className="text-[8px] text-muted-foreground mt-2">{previewTexts.endedNote}</p>
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
              {eventName || previewTexts.eventNamePlaceholder}
            </h2>
            {description && (
              <p className="text-[8px] text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2">{description}</p>
            )}
            {customImageUrl && (
              <img src={customImageUrl} alt="" className="mx-auto mt-1 max-w-[60px] max-h-[20px] object-contain" />
            )}
            <p className="text-[8px] text-muted-foreground mt-1">
              {previewTexts.revealedInfo}
            </p>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between p-2 border-b border-border">
          <div>
            <span className={`${previewFontSize} font-bold text-foreground`} style={{ fontFamily: fontStyle }}>
              {eventName || previewTexts.eventNameShort}
            </span>
            {description && (
              <p className="text-[7px] text-muted-foreground line-clamp-1">{description}</p>
            )}
            {customImageUrl && (
              <img src={customImageUrl} alt="" className="mt-0.5 max-w-[50px] max-h-[18px] object-contain" />
            )}
            <p className="text-[7px] text-muted-foreground mt-0.5">{previewTexts.revealedInfo}</p>
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
        {eventName || previewTexts.eventNamePlaceholder}
      </h2>
      <p className="text-[9px] text-muted-foreground mb-4">
        {previewTexts.expiredDesc}
      </p>
      <button className="bg-primary text-primary-foreground text-[9px] font-medium px-4 py-2 rounded-md">
        {previewTexts.expiredButton}
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
        <span className="text-sm font-medium text-foreground">{previewTexts.previewLabel}</span>
        <Select value={previewState} onValueChange={(v) => setPreviewState(v as PreviewState)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(previewTexts.stateLabels).map(([value, label]) => (
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
        {previewTexts.filterLabel}: {previewTexts.filters[filterType]}
      </p>
    </div>
  );
};

export default EventPreview;
