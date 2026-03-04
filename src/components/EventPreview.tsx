import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFontById, loadGoogleFont, getEventFontFamily, EventFontFamily } from "@/lib/eventFonts";
import { FilterType, getFilterClass } from "@/lib/photoFilters";
import prohibidoIcon from "@/assets/prohibido.png";
import { Camera, Grid2x2, Image, List, Mic, Play, Share2, Video, LogOut } from "lucide-react";

type PreviewState = "not_started" | "active" | "ended" | "revealed" | "expired";
type HeaderStyle = "gradient" | "modern";

interface EventPreviewProps {
  eventName: string;
  description?: string;
  fontFamily: EventFontFamily;
  fontSize: string;
  backgroundImageUrl?: string;
  customImageUrl?: string;
  filterType: FilterType;
  language?: string;
  allowVideoRecording?: boolean;
  allowAudioRecording?: boolean;
  headerStyle?: HeaderStyle;
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
  actionTitle: string;
  takePhoto: string;
  videoLabel: string;
  audioLabel: string;
  uploadCountdown: string;
  revealTomorrow: string;
  endedTitle: string;
  endedDesc: string;
  revealCountdown: string;
  endedNote: string;
  revealedInfo: string;
  mediaCounts: string;
  expiredDesc: string;
  expiredButton: string;
  previewLabel: string;
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
    actionTitle: "¿Qué quieres hacer?",
    takePhoto: "Hacer foto",
    videoLabel: "Vídeo",
    audioLabel: "Audio",
    uploadCountdown: "Solo quedan 45 minutos para que el evento se termine",
    revealTomorrow: "Mañana a las 12:00 todo será revelado en este mismo espacio 📸✨",
    endedTitle: "Evento finalizado",
    endedDesc: "Ya no se pueden subir más contenidos",
    revealCountdown: "Faltan 3h 15min para el revelado",
    endedNote: "¡Qué nervios! 📸✨",
    revealedInfo: "✨ Ya se ha revelado todo el contenido",
    mediaCounts: "📷 12 fotos / 📹 3 vídeos / 🔈 2 audios",
    expiredDesc: "El enlace ya ha caducado",
    expiredButton: "Volver",
    previewLabel: "Vista previa",
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
    actionTitle: "What do you want to do?",
    takePhoto: "Take photo",
    videoLabel: "Video",
    audioLabel: "Audio",
    uploadCountdown: "Only 45 minutes left until the event ends",
    revealTomorrow: "Tomorrow at 12:00 everything will be revealed in this same space 📸✨",
    endedTitle: "Event ended",
    endedDesc: "No more content can be uploaded",
    revealCountdown: "3h 15min until reveal",
    endedNote: "So exciting! 📸✨",
    revealedInfo: "✨ All content has been revealed",
    mediaCounts: "📷 12 photos / 📹 3 videos / 🔈 2 audios",
    expiredDesc: "This link has expired",
    expiredButton: "Go back",
    previewLabel: "Preview",
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
    actionTitle: "Cosa vuoi fare?",
    takePhoto: "Scatta foto",
    videoLabel: "Video",
    audioLabel: "Audio",
    uploadCountdown: "Mancano solo 45 minuti alla fine dell'evento",
    revealTomorrow: "Domani alle 12:00 tutto sarà rivelato in questo stesso spazio 📸✨",
    endedTitle: "Evento terminato",
    endedDesc: "Non è più possibile caricare contenuti",
    revealCountdown: "Mancano 3h 15min alla rivelazione",
    endedNote: "Che emozione! 📸✨",
    revealedInfo: "✨ Tutto il contenuto è stato rivelato",
    mediaCounts: "📷 12 foto / 📹 3 video / 🔈 2 audio",
    expiredDesc: "Il link è scaduto",
    expiredButton: "Torna indietro",
    previewLabel: "Anteprima",
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
  allowVideoRecording = false,
  allowAudioRecording = false,
  headerStyle = "modern",
}: EventPreviewProps) => {
  const [previewState, setPreviewState] = useState<PreviewState>("active");
  const previewTexts = PREVIEW_TEXTS[(language as "es" | "en" | "it")] ?? PREVIEW_TEXTS.es;

  if (fontFamily && fontFamily !== "system") {
    const font = getFontById(fontFamily);
    loadGoogleFont(font);
  }

  const fontStyle = getEventFontFamily(fontFamily);
  const isModernHeader = headerStyle === "modern";
  const mediaCountText = previewTexts.mediaCounts;

  const previewFontSizeMap: Record<string, string> = {
    "text-xl": "text-sm",
    "text-2xl": "text-base",
    "text-3xl": "text-lg",
    "text-4xl": "text-xl",
    "text-5xl": "text-2xl",
  };
  const previewFontSize = previewFontSizeMap[fontSize] || "text-lg";

  const renderHeader = () => {
    if (backgroundImageUrl) {
      return (
        <div className="relative h-28 w-full overflow-hidden rounded-b-2xl">
          <img src={backgroundImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
          <div
            className={`absolute inset-0 ${
              isModernHeader ? "bg-black/70" : "bg-gradient-to-b from-transparent via-transparent to-background"
            }`}
          />

          <div className="absolute top-2 left-2">
            <div className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white">
              <LogOut className="w-3 h-3" />
            </div>
          </div>
          <div className="absolute top-2 right-2">
            <div className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white">
              <Share2 className="w-3 h-3" />
            </div>
          </div>

          {isModernHeader ? (
            <div className="absolute inset-x-0 bottom-0 px-3 pb-2 text-left text-white">
              <h2 className={`${previewFontSize} font-bold leading-tight`} style={{ fontFamily: fontStyle }}>
                {eventName || previewTexts.eventNamePlaceholder}
              </h2>
              {description ? <p className="text-[8px] text-white/90 mt-0.5 line-clamp-1">{description}</p> : null}
              <p className="text-[8px] text-white/90 mt-0.5">{mediaCountText}</p>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between p-2 border-b border-border">
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
          <LogOut className="w-3 h-3 text-foreground" />
        </div>
        <div className="text-center min-w-0 px-2">
          <h2 className={`${previewFontSize} font-bold text-foreground truncate`} style={{ fontFamily: fontStyle }}>
            {eventName || previewTexts.eventNameShort}
          </h2>
          <p className="text-[7px] text-muted-foreground truncate">{mediaCountText}</p>
        </div>
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
          <Share2 className="w-3 h-3 text-foreground" />
        </div>
      </div>
    );
  };

  const renderLegacyHeaderInfo = () => {
    if (!backgroundImageUrl || isModernHeader) return null;
    return (
      <div className="relative -mt-5 px-3 text-center">
        <h2 className={`${previewFontSize} font-bold tracking-tight text-foreground leading-tight`} style={{ fontFamily: fontStyle }}>
          {eventName || previewTexts.eventNamePlaceholder}
        </h2>
        {description ? <p className="text-[8px] text-muted-foreground mt-0.5 line-clamp-1">{description}</p> : null}
        <p className="text-[8px] text-muted-foreground mt-0.5">{mediaCountText}</p>
      </div>
    );
  };

  const renderActionButtons = () => {
    const onlyPhoto = !allowVideoRecording && !allowAudioRecording;

    if (onlyPhoto) {
      return (
        <button className="bg-black text-white text-[9px] font-semibold px-4 py-2 rounded-lg mb-3">
          {previewTexts.takePhoto}
        </button>
      );
    }

    const actions = [
      { key: "photo", label: "Foto", icon: Camera },
      ...(allowVideoRecording ? [{ key: "video", label: previewTexts.videoLabel, icon: Video }] : []),
      ...(allowAudioRecording ? [{ key: "audio", label: previewTexts.audioLabel, icon: Mic }] : []),
    ];

    return (
      <div className="w-full space-y-2 mb-3">
        <p className="text-[9px] font-semibold text-foreground text-center">{previewTexts.actionTitle}</p>
        <div className={`grid gap-2 ${actions.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.key} className="h-11 rounded-xl border border-border bg-card flex flex-col items-center justify-center gap-1">
                <span className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                  <Icon className="w-3 h-3 text-white" />
                </span>
                <span className="text-[8px] font-medium text-foreground">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderNotStartedPreview = () => (
    <div className="flex flex-col h-full bg-background">
      {renderHeader()}
      {renderLegacyHeaderInfo()}
      <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
        <img src={prohibidoIcon} alt="" className="w-12 h-12 object-contain mb-2" />
        <p className="text-[10px] font-semibold text-foreground mb-1">{previewTexts.notStartedTitle}</p>
        <p className="text-[8px] text-muted-foreground mb-2">{previewTexts.notStartedDesc}</p>
        <div className="bg-card border border-border rounded px-2 py-1.5">
          <p className="text-[7px] text-muted-foreground">{previewTexts.startsLabel}</p>
          <p className="text-[9px] font-bold text-foreground">{previewTexts.startsValue}</p>
        </div>
        <p className="text-[9px] text-primary font-medium mt-2">{previewTexts.countdown}</p>
        {customImageUrl ? <img src={customImageUrl} alt="" className="mt-auto max-w-[80px] max-h-[30px] object-contain" /> : null}
      </div>
    </div>
  );

  const renderActivePreview = () => (
    <div className="flex flex-col h-full bg-background">
      {renderHeader()}
      {renderLegacyHeaderInfo()}
      <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
        {renderActionButtons()}
        <div className="bg-card border border-border rounded px-2 py-1.5 mb-2">
          <p className="text-[8px] text-primary font-medium">{previewTexts.uploadCountdown}</p>
        </div>
        <p className="text-[7px] text-muted-foreground">{previewTexts.revealTomorrow}</p>
        {customImageUrl ? <img src={customImageUrl} alt="" className="mt-auto max-w-[80px] max-h-[30px] object-contain" /> : null}
      </div>
    </div>
  );

  const renderEndedPreview = () => (
    <div className="flex flex-col h-full bg-background">
      {renderHeader()}
      {renderLegacyHeaderInfo()}
      <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
        <img src={prohibidoIcon} alt="" className="w-12 h-12 object-contain mb-2" />
        <p className="text-[10px] font-semibold text-foreground mb-1">{previewTexts.endedTitle}</p>
        <p className="text-[8px] text-muted-foreground mb-2">{previewTexts.endedDesc}</p>
        <div className="bg-card border border-border rounded px-2 py-1.5">
          <p className="text-[9px] text-primary font-medium">{previewTexts.revealCountdown}</p>
        </div>
        <p className="text-[8px] text-muted-foreground mt-2">{previewTexts.endedNote}</p>
        {customImageUrl ? <img src={customImageUrl} alt="" className="mt-auto max-w-[80px] max-h-[30px] object-contain" /> : null}
      </div>
    </div>
  );

  const renderRevealedPreview = () => (
    <div className="flex flex-col h-full bg-background">
      {renderHeader()}
      {renderLegacyHeaderInfo()}

      <div className="px-2.5 pt-2 pb-1">
        <p className="text-[8px] font-semibold text-foreground">{previewTexts.revealedInfo}</p>
      </div>

      <div className="px-2.5 pb-2">
        <div className="rounded-xl bg-muted/50 p-1 grid grid-cols-2 gap-1">
          <button className="h-6 rounded-lg bg-background border border-border flex items-center justify-center">
            <List className="w-3 h-3" />
          </button>
          <button className="h-6 rounded-lg flex items-center justify-center text-muted-foreground">
            <Grid2x2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex-1 px-2.5 pb-2 overflow-hidden">
        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`aspect-square rounded-md overflow-hidden relative ${getFilterClass(filterType)}`}>
              {i === 2 ? (
                <div className="w-full h-full bg-zinc-200 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-black/70 flex items-center justify-center">
                    <Play className="w-3 h-3 text-white fill-white" />
                  </div>
                </div>
              ) : i === 4 ? (
                <div className="w-full h-full bg-zinc-100 flex items-center justify-center px-2">
                  <div className="h-1.5 w-full rounded-full bg-[#f06a5f]/40" />
                </div>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-muted-foreground/30 to-muted-foreground/10" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-3 right-3">
        <div className="w-8 h-8 rounded-full bg-[#FF6565] shadow flex items-center justify-center">
          <Play className="w-3.5 h-3.5 text-white fill-white" />
        </div>
      </div>
    </div>
  );

  const renderExpiredPreview = () => (
    <div className="flex flex-col items-center justify-center h-full bg-background p-4 text-center">
      <h2 className={`${previewFontSize} font-bold text-foreground mb-3`} style={{ fontFamily: fontStyle }}>
        {eventName || previewTexts.eventNamePlaceholder}
      </h2>
      <p className="text-[9px] text-muted-foreground mb-4">{previewTexts.expiredDesc}</p>
      <button className="bg-primary text-primary-foreground text-[9px] font-medium px-4 py-2 rounded-md">
        {previewTexts.expiredButton}
      </button>
      {customImageUrl ? <img src={customImageUrl} alt="" className="mt-auto max-w-[80px] max-h-[30px] object-contain" /> : null}
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

      <div className="flex justify-center">
        <div className="relative w-[180px] h-[360px] bg-foreground rounded-[24px] p-1.5 shadow-lg">
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-12 h-3 bg-foreground rounded-b-lg z-20" />
          <div className="w-full h-full bg-background rounded-[20px] overflow-hidden relative">{renderPreview()}</div>
        </div>
      </div>

    </div>
  );
};

export default EventPreview;
