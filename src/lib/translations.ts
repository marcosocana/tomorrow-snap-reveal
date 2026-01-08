export type Language = "es" | "en" | "it";

export interface TranslationStrings {
  // EventAccess page
  eventAccess: {
    accessingEvent: string;
    eventNotFound: string;
    invalidUrl: string;
    error: string;
    errorAccessing: string;
  };
  // Camera page
  camera: {
    takePhoto: string;
    uploading: string;
    uploadSuccess: string;
    uploadSuccessDesc: string;
    uploadError: string;
    limitReached: string;
    limitReachedDesc: string;
    eventNotStarted: string;
    eventNotStartedDesc: string;
    eventEnded: string;
    eventEndedDesc: string;
    photosRevealed: string;
    photosRevealedDesc: string;
    seePhotos: string;
    countdownReveal: string;
    countdownStart: string;
    countdownUpload: string;
    uploadUntil: string;
    today: string;
    tomorrow: string;
    theDay: string;
    atTime: string;
    hours: string;
    minutes: string;
    seconds: string;
    remaining: string;
    willStartOn: string;
    periodNotStarted: string;
    revealingSoon: string;
    howExciting: string;
    eventStartsOn: string;
    waitingReveal: string;
  };
  // Gallery page
  gallery: {
    downloadAll: string;
    downloading: string;
    downloadSuccess: string;
    downloadSuccessDesc: string;
    downloadError: string;
    welcome: string;
    welcomeDesc: string;
    noPhotos: string;
    loadingPhotos: string;
    deleteConfirm: string;
    deleteSuccess: string;
    deleteError: string;
    shareEvent: string;
  };
  // Share dialog
  share: {
    title: string;
    copied: string;
    copyLink: string;
    shareOn: string;
  };
  // Common
  common: {
    loading: string;
    error: string;
    back: string;
    close: string;
    save: string;
    cancel: string;
    confirm: string;
    delete: string;
    share: string;
    photos: string;
  };
}

const translations: Record<Language, TranslationStrings> = {
  es: {
    eventAccess: {
      accessingEvent: "Accediendo al evento...",
      eventNotFound: "Evento no encontrado",
      invalidUrl: "La URL del evento no es válida",
      error: "Error",
      errorAccessing: "Hubo un problema al acceder al evento",
    },
    camera: {
      takePhoto: "Tomar foto",
      uploading: "Subiendo...",
      uploadSuccess: "Foto subida con éxito",
      uploadSuccessDesc: "La podrás ver cuando se revelen",
      uploadError: "No se pudo guardar la foto",
      limitReached: "Límite alcanzado",
      limitReachedDesc: "El evento ha alcanzado el límite de fotos",
      eventNotStarted: "El evento aún no ha comenzado",
      eventNotStartedDesc: "El período para subir fotos comenzará pronto.",
      eventEnded: "El evento ha terminado",
      eventEndedDesc: "Ya no se pueden subir más fotos.",
      photosRevealed: "¡Ya se han revelado las fotos!",
      photosRevealedDesc: "Puedes ver todas las fotos del evento.",
      seePhotos: "Ver",
      countdownReveal: "Quedan {hours} horas, {minutes} minutos y {seconds} segundos para que se revelen las fotos. ¡Qué nervios!",
      countdownStart: "Quedan {hours} horas, {minutes} minutos y {seconds} segundos para que comience el evento",
      countdownUpload: "Puedes subir todas las fotos que quieras hasta {date} a las {time} horas. ¡Solo quedan {hours} horas, {minutes} minutos y {seconds} segundos!",
      uploadUntil: "Puedes subir todas las fotos que quieras hasta",
      today: "hoy",
      tomorrow: "mañana",
      theDay: "el día",
      atTime: "a las",
      hours: "horas",
      minutes: "minutos",
      seconds: "segundos",
      remaining: "Solo quedan",
      willStartOn: "El evento comenzará:",
      periodNotStarted: "El período para subir fotos comenzará pronto.",
      revealingSoon: "Las fotos se revelarán pronto",
      howExciting: "¡Qué nervios!",
      eventStartsOn: "El evento comienza el",
      waitingReveal: "Esperando el revelado...",
    },
    gallery: {
      downloadAll: "Descargar todas",
      downloading: "Descargando...",
      downloadSuccess: "Descarga lista",
      downloadSuccessDesc: "Se ha descargado el archivo ZIP con todas las fotos",
      downloadError: "Error al descargar las fotos",
      welcome: "¡Bienvenido/a!",
      welcomeDesc: "Aquí aparecerán todas las fotos del evento",
      noPhotos: "No hay fotos",
      loadingPhotos: "Cargando fotos...",
      deleteConfirm: "¿Estás seguro de que quieres eliminar esta foto?",
      deleteSuccess: "Foto eliminada",
      deleteError: "Error al eliminar la foto",
      shareEvent: "Compartir evento",
    },
    share: {
      title: "Compartir evento",
      copied: "¡Enlace copiado!",
      copyLink: "Copiar enlace",
      shareOn: "Compartir en",
    },
    common: {
      loading: "Cargando...",
      error: "Error",
      back: "Volver",
      close: "Cerrar",
      save: "Guardar",
      cancel: "Cancelar",
      confirm: "Confirmar",
      delete: "Eliminar",
      share: "Compartir",
      photos: "fotos",
    },
  },
  en: {
    eventAccess: {
      accessingEvent: "Accessing event...",
      eventNotFound: "Event not found",
      invalidUrl: "The event URL is not valid",
      error: "Error",
      errorAccessing: "There was a problem accessing the event",
    },
    camera: {
      takePhoto: "Take photo",
      uploading: "Uploading...",
      uploadSuccess: "Photo uploaded successfully",
      uploadSuccessDesc: "You'll see it when photos are revealed",
      uploadError: "Could not save the photo",
      limitReached: "Limit reached",
      limitReachedDesc: "The event has reached its photo limit",
      eventNotStarted: "The event hasn't started yet",
      eventNotStartedDesc: "The photo upload period will begin soon.",
      eventEnded: "The event has ended",
      eventEndedDesc: "No more photos can be uploaded.",
      photosRevealed: "Photos have been revealed!",
      photosRevealedDesc: "You can see all the event photos.",
      seePhotos: "View",
      countdownReveal: "{hours} hours, {minutes} minutes and {seconds} seconds left until photos are revealed. How exciting!",
      countdownStart: "{hours} hours, {minutes} minutes and {seconds} seconds left until the event starts",
      countdownUpload: "You can upload as many photos as you want until {date} at {time}. Only {hours} hours, {minutes} minutes and {seconds} seconds left!",
      uploadUntil: "You can upload as many photos as you want until",
      today: "today",
      tomorrow: "tomorrow",
      theDay: "on",
      atTime: "at",
      hours: "hours",
      minutes: "minutes",
      seconds: "seconds",
      remaining: "Only",
      willStartOn: "The event will start:",
      periodNotStarted: "The photo upload period will begin soon.",
      revealingSoon: "Photos will be revealed soon",
      howExciting: "How exciting!",
      eventStartsOn: "The event starts on",
      waitingReveal: "Waiting for reveal...",
    },
    gallery: {
      downloadAll: "Download all",
      downloading: "Downloading...",
      downloadSuccess: "Download ready",
      downloadSuccessDesc: "The ZIP file with all photos has been downloaded",
      downloadError: "Error downloading photos",
      welcome: "Welcome!",
      welcomeDesc: "All event photos will appear here",
      noPhotos: "No photos",
      loadingPhotos: "Loading photos...",
      deleteConfirm: "Are you sure you want to delete this photo?",
      deleteSuccess: "Photo deleted",
      deleteError: "Error deleting photo",
      shareEvent: "Share event",
    },
    share: {
      title: "Share event",
      copied: "Link copied!",
      copyLink: "Copy link",
      shareOn: "Share on",
    },
    common: {
      loading: "Loading...",
      error: "Error",
      back: "Back",
      close: "Close",
      save: "Save",
      cancel: "Cancel",
      confirm: "Confirm",
      delete: "Delete",
      share: "Share",
      photos: "photos",
    },
  },
  it: {
    eventAccess: {
      accessingEvent: "Accesso all'evento...",
      eventNotFound: "Evento non trovato",
      invalidUrl: "L'URL dell'evento non è valido",
      error: "Errore",
      errorAccessing: "Si è verificato un problema nell'accesso all'evento",
    },
    camera: {
      takePhoto: "Scatta foto",
      uploading: "Caricamento...",
      uploadSuccess: "Foto caricata con successo",
      uploadSuccessDesc: "La vedrai quando le foto saranno rivelate",
      uploadError: "Impossibile salvare la foto",
      limitReached: "Limite raggiunto",
      limitReachedDesc: "L'evento ha raggiunto il limite di foto",
      eventNotStarted: "L'evento non è ancora iniziato",
      eventNotStartedDesc: "Il periodo di caricamento delle foto inizierà presto.",
      eventEnded: "L'evento è terminato",
      eventEndedDesc: "Non è più possibile caricare foto.",
      photosRevealed: "Le foto sono state rivelate!",
      photosRevealedDesc: "Puoi vedere tutte le foto dell'evento.",
      seePhotos: "Vedi",
      countdownReveal: "Mancano {hours} ore, {minutes} minuti e {seconds} secondi alla rivelazione delle foto. Che emozione!",
      countdownStart: "Mancano {hours} ore, {minutes} minuti e {seconds} secondi all'inizio dell'evento",
      countdownUpload: "Puoi caricare tutte le foto che vuoi fino a {date} alle {time}. Mancano solo {hours} ore, {minutes} minuti e {seconds} secondi!",
      uploadUntil: "Puoi caricare tutte le foto che vuoi fino a",
      today: "oggi",
      tomorrow: "domani",
      theDay: "il giorno",
      atTime: "alle",
      hours: "ore",
      minutes: "minuti",
      seconds: "secondi",
      remaining: "Mancano solo",
      willStartOn: "L'evento inizierà:",
      periodNotStarted: "Il periodo di caricamento delle foto inizierà presto.",
      revealingSoon: "Le foto saranno rivelate presto",
      howExciting: "Che emozione!",
      eventStartsOn: "L'evento inizia il",
      waitingReveal: "In attesa della rivelazione...",
    },
    gallery: {
      downloadAll: "Scarica tutte",
      downloading: "Download in corso...",
      downloadSuccess: "Download pronto",
      downloadSuccessDesc: "Il file ZIP con tutte le foto è stato scaricato",
      downloadError: "Errore durante il download delle foto",
      welcome: "Benvenuto/a!",
      welcomeDesc: "Qui appariranno tutte le foto dell'evento",
      noPhotos: "Nessuna foto",
      loadingPhotos: "Caricamento foto...",
      deleteConfirm: "Sei sicuro di voler eliminare questa foto?",
      deleteSuccess: "Foto eliminata",
      deleteError: "Errore nell'eliminazione della foto",
      shareEvent: "Condividi evento",
    },
    share: {
      title: "Condividi evento",
      copied: "Link copiato!",
      copyLink: "Copia link",
      shareOn: "Condividi su",
    },
    common: {
      loading: "Caricamento...",
      error: "Errore",
      back: "Indietro",
      close: "Chiudi",
      save: "Salva",
      cancel: "Annulla",
      confirm: "Conferma",
      delete: "Elimina",
      share: "Condividi",
      photos: "foto",
    },
  },
};

export const getTranslations = (language: Language): TranslationStrings => {
  return translations[language] || translations.es;
};

export const LANGUAGES = [
  { code: "es" as Language, name: "Español", flag: "🇪🇸" },
  { code: "en" as Language, name: "English", flag: "🇬🇧" },
  { code: "it" as Language, name: "Italiano", flag: "🇮🇹" },
];

export const getLanguageByCode = (code: string): { code: Language; name: string; flag: string } | undefined => {
  return LANGUAGES.find(l => l.code === code);
};

// Helper to get current event language from localStorage
export const getEventLanguage = (): Language => {
  const lang = localStorage.getItem("eventLanguage");
  if (lang === "en" || lang === "it" || lang === "es") {
    return lang;
  }
  return "es";
};

// Get date-fns locale based on language
export const getDateLocale = (language: Language) => {
  switch (language) {
    case "en":
      return undefined; // date-fns default is English
    case "it":
      return undefined; // Will need to import if needed
    default:
      return undefined; // Will use es locale where imported
  }
};
