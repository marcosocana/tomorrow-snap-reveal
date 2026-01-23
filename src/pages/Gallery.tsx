import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Film, Trash2, Download, MoreVertical, Share2, Play } from "lucide-react";
import StoriesViewer from "@/components/StoriesViewer";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { es, enUS, it } from "date-fns/locale";
import confetti from "canvas-confetti";
import JSZip from "jszip";
import heartOutline from "@/assets/heart-outline.svg";
import heartFilled from "@/assets/heart-filled.svg";
import ShareDialog from "@/components/ShareDialog";
import { FilterType, getFilterClass, getGrainClass, applyFilterToCanvas } from "@/lib/photoFilters";
import { getTranslations, getEventLanguage, getEventTimezone, getLocalDateInTimezone, Language } from "@/lib/translations";
import { EventFontFamily, getEventFontFamily } from "@/lib/eventFonts";

interface Photo {
  id: string;
  image_url: string;
  captured_at: string;
  thumbnailUrl?: string;
  fullQualityUrl?: string;
  likeCount?: number;
  hasLiked?: boolean;
}

const PHOTOS_PER_PAGE = 12;

const getDateLocale = (language: Language) => {
  switch (language) {
    case "en": return enUS;
    case "it": return it;
    default: return es;
  }
};

const Gallery = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const eventId = localStorage.getItem("eventId");
  const eventName = localStorage.getItem("eventName");
  const [eventPassword, setEventPassword] = useState<string>("");
  const [filterType, setFilterType] = useState<FilterType>("vintage");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [eventCustomImage, setEventCustomImage] = useState<string | null>(null);
  const [eventDescription, setEventDescription] = useState<string | null>(null);
  const [eventBackgroundImage, setEventBackgroundImage] = useState<string | null>(null);
  const [showStories, setShowStories] = useState(false);
  const [allPhotosForStories, setAllPhotosForStories] = useState<Photo[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [expiryRedirectUrl, setExpiryRedirectUrl] = useState<string | null>(null);
  const [eventFontFamily, setEventFontFamily] = useState<EventFontFamily>("system");
  const [eventFontSize, setEventFontSize] = useState<string>("text-3xl");

  // Get translations and timezone
  const language = getEventLanguage();
  const t = getTranslations(language);
  const timezone = getEventTimezone();
  const dateLocale = getDateLocale(language);

  // Helper to format date in local timezone
  const formatLocalDate = (dateStr: string, formatStr: string) => {
    const localDate = getLocalDateInTimezone(dateStr, timezone);
    return format(localDate, formatStr, { locale: dateLocale });
  };

  const loadPhotos = useCallback(async (pageNum: number) => {
    if (!eventId) return;

    try {
      const from = pageNum * PHOTOS_PER_PAGE;
      const to = from + PHOTOS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from("photos")
        .select("*", { count: 'exact' })
        .eq("event_id", eventId)
        .order("captured_at", { ascending: true })
        .range(from, to);

      if (error) throw error;

      // Get like counts for each photo
      const photoIds = (data || []).map(p => p.id);
      const { data: likesData } = await supabase
        .from("photo_likes")
        .select("photo_id")
        .in("photo_id", photoIds);

      const likeCounts = (likesData || []).reduce((acc: any, like: any) => {
        acc[like.photo_id] = (acc[like.photo_id] || 0) + 1;
        return acc;
      }, {});

      // Check which photos current user has liked
      const likedPhotos = JSON.parse(localStorage.getItem("likedPhotos") || "[]");

      // Get signed URLs for thumbnails and full quality
      const photosWithUrls = await Promise.all(
        (data || []).map(async (photo) => {
          const { data: thumbnailData } = await supabase.storage
            .from("event-photos")
            .createSignedUrl(photo.image_url, 3600, {
              transform: {
                width: 400,
                height: 400,
                quality: 60
              }
            });

          const { data: fullQualityData } = await supabase.storage
            .from("event-photos")
            .createSignedUrl(photo.image_url, 3600);

          return {
            ...photo,
            thumbnailUrl: thumbnailData?.signedUrl || "",
            fullQualityUrl: fullQualityData?.signedUrl || "",
            likeCount: likeCounts[photo.id] || 0,
            hasLiked: likedPhotos.includes(photo.id),
          };
        })
      );

      // Sort photos by captured_at to ensure correct order (oldest first)
      const sortedPhotos = photosWithUrls.sort((a, b) => 
        new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
      );

      setPhotos(prev => pageNum === 0 ? sortedPhotos as any : [...prev, ...sortedPhotos as any]);
      setHasMore(count ? (from + photosWithUrls.length) < count : false);
      
      // Set total photos count on first load
      if (pageNum === 0 && count !== null) {
        setTotalPhotos(count);
      }
    } catch (error) {
      console.error("Error loading photos:", error);
      // Silently handle errors (like 416 when reaching end of data)
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    if (!eventId) {
      navigate("/");
      return;
    }

    // Load event password, filter type, custom image, description, background and expiry for sharing
    const loadEventData = async () => {
      const { data } = await supabase
        .from("events")
        .select("password_hash, filter_type, custom_image_url, description, background_image_url, expiry_date, expiry_redirect_url, font_family, font_size")
        .eq("id", eventId)
        .maybeSingle();
      if (data) {
        setEventPassword(data.password_hash);
        setFilterType((data.filter_type as FilterType) || "vintage");
        setEventCustomImage(data.custom_image_url);
        setEventDescription(data.description);
        setEventBackgroundImage(data.background_image_url);
        setEventFontFamily(((data as any).font_family as EventFontFamily) || "system");
        setEventFontSize((data as any).font_size || "text-3xl");
        
        // Check if event is expired
        if (data.expiry_date) {
          const expiryDate = new Date(data.expiry_date);
          const now = new Date();
          if (now > expiryDate) {
            setIsExpired(true);
            setExpiryRedirectUrl(data.expiry_redirect_url);
          }
        }
      }
    };
    loadEventData();

    // Always scroll to top when gallery loads
    window.scrollTo(0, 0);

    // Check if this is the first visit to gallery for this event
    const hasSeenWelcome = localStorage.getItem(`gallery-welcome-${eventId}`);
    if (!hasSeenWelcome) {
      setShowWelcome(true);
      localStorage.setItem(`gallery-welcome-${eventId}`, "true");
      
      // Trigger confetti
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#f5e6d3', '#d4a574', '#8b4513']
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#f5e6d3', '#d4a574', '#8b4513']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }

    loadPhotos(0);
  }, [eventId, navigate, loadPhotos]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadPhotos(nextPage);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, page, loadPhotos]);

  const handleLogout = () => {
    localStorage.removeItem("eventId");
    localStorage.removeItem("eventName");
    localStorage.removeItem("eventLanguage");
    localStorage.removeItem("eventTimezone");
    navigate("/");
  };

  const handleDeletePhoto = async (photoId: string, imageUrl: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("event-photos")
        .remove([imageUrl]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("photos")
        .delete()
        .eq("id", photoId);

      if (dbError) throw dbError;

      setPhotos(photos.filter(p => p.id !== photoId));
      setSelectedPhoto(null);
      
      toast({
        title: t.gallery.deleteSuccess,
        description: language === "en" ? "Photo deleted successfully" : language === "it" ? "Foto eliminata con successo" : "La foto se eliminó correctamente",
      });
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast({
        title: t.common.error,
        description: t.gallery.deleteError,
        variant: "destructive",
      });
    }
  };

  const handleLikePhoto = async (photoId: string) => {
    try {
      // Check if already liked
      const likedPhotos = JSON.parse(localStorage.getItem("likedPhotos") || "[]");
      if (likedPhotos.includes(photoId)) {
        return; // Already liked, do nothing
      }

      // Add like to database
      const { error } = await supabase
        .from("photo_likes")
        .insert({ photo_id: photoId });

      if (error) throw error;

      // Update localStorage
      likedPhotos.push(photoId);
      localStorage.setItem("likedPhotos", JSON.stringify(likedPhotos));

      // Update UI
      setPhotos(photos.map(p => 
        p.id === photoId 
          ? { ...p, likeCount: (p.likeCount || 0) + 1, hasLiked: true }
          : p
      ));

      // Update selected photo if it's the one being liked
      if (selectedPhoto && selectedPhoto.id === photoId) {
        setSelectedPhoto({
          ...selectedPhoto,
          likeCount: (selectedPhoto.likeCount || 0) + 1,
          hasLiked: true
        });
      }
    } catch (error) {
      console.error("Error liking photo:", error);
    }
  };

  const handleOpenStories = async () => {
    if (!eventId) return;
    
    setLoadingStories(true);
    try {
      // Fetch ALL photos for stories
      const { data: allPhotos, error } = await supabase
        .from("photos")
        .select("*")
        .eq("event_id", eventId)
        .order("captured_at", { ascending: true });

      if (error) throw error;

      // Get like counts for all photos
      const photoIds = (allPhotos || []).map(p => p.id);
      const { data: likesData } = await supabase
        .from("photo_likes")
        .select("photo_id")
        .in("photo_id", photoIds);

      const likeCounts = (likesData || []).reduce((acc: any, like: any) => {
        acc[like.photo_id] = (acc[like.photo_id] || 0) + 1;
        return acc;
      }, {});

      // Check which photos current user has liked
      const likedPhotos = JSON.parse(localStorage.getItem("likedPhotos") || "[]");

      // Get signed URLs for all photos
      const photosWithUrls = await Promise.all(
        (allPhotos || []).map(async (photo) => {
          const { data: fullQualityData } = await supabase.storage
            .from("event-photos")
            .createSignedUrl(photo.image_url, 3600);

          return {
            ...photo,
            fullQualityUrl: fullQualityData?.signedUrl || "",
            likeCount: likeCounts[photo.id] || 0,
            hasLiked: likedPhotos.includes(photo.id),
          };
        })
      );

      setAllPhotosForStories(photosWithUrls as Photo[]);
      setShowStories(true);
    } catch (error) {
      console.error("Error loading all photos for stories:", error);
      toast({
        title: t.common.error,
        description: language === "en" ? "Error loading photos" : language === "it" ? "Errore nel caricamento delle foto" : "Error al cargar las fotos",
        variant: "destructive",
      });
    } finally {
      setLoadingStories(false);
    }
  };

  const handleDownloadPhoto = async (signedUrl: string, capturedAt: string, withFilter: boolean = true) => {
    try {
      const preparingText = language === "en" ? "Preparing download" : language === "it" ? "Preparando download" : "Preparando descarga";
      const applyingFilterText = language === "en" ? "Applying filter..." : language === "it" ? "Applicando filtro..." : "Aplicando filtro...";
      const downloadingOriginalText = language === "en" ? "Downloading original..." : language === "it" ? "Scaricando originale..." : "Descargando original...";
      
      toast({
        title: preparingText,
        description: withFilter ? applyingFilterText : downloadingOriginalText,
      });

      let blob: Blob;
      
      if (withFilter && filterType !== 'none') {
        // Apply filter before download
        blob = await applyFilterToCanvas(signedUrl, filterType);
      } else {
        // Download original
        const response = await fetch(signedUrl);
        blob = await response.blob();
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix = withFilter && filterType !== 'none' ? `-${filterType}` : '-original';
      a.download = `foto-${format(new Date(capturedAt), "dd-MM-yyyy-HHmm")}${suffix}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      const downloadedText = language === "en" ? "Photo downloaded" : language === "it" ? "Foto scaricata" : "Foto descargada";
      const downloadedDescText = language === "en" ? "Photo downloaded successfully" : language === "it" ? "Foto scaricata con successo" : "La foto se ha descargado correctamente";
      
      toast({
        title: downloadedText,
        description: downloadedDescText,
      });
    } catch (error) {
      console.error("Error downloading photo:", error);
      toast({
        title: t.common.error,
        description: t.gallery.downloadError,
        variant: "destructive",
      });
    }
  };

  const handleDownloadAll = async (withFilter: boolean = true) => {
    try {
      const preparingText = language === "en" ? "Preparing download" : language === "it" ? "Preparando download" : "Preparando descarga";
      const downloadingAllText = language === "en" 
        ? `Downloading all photos${withFilter && filterType !== 'none' ? ' with filter' : ' (originals)'}...`
        : language === "it"
        ? `Scaricando tutte le foto${withFilter && filterType !== 'none' ? ' con filtro' : ' originali'}...`
        : `Descargando todas las fotos${withFilter && filterType !== 'none' ? ' con filtro' : ' originales'}...`;
      
      toast({
        title: preparingText,
        description: downloadingAllText,
      });

      // Fetch ALL photos from the event
      const { data: allPhotos, error } = await supabase
        .from("photos")
        .select("*")
        .eq("event_id", eventId)
        .order("captured_at", { ascending: true });

      if (error) throw error;

      const zip = new JSZip();
      
      // Download all photos and add to zip
      for (let i = 0; i < (allPhotos || []).length; i++) {
        const photo = allPhotos![i];
        
        // Get signed URL for full quality
        const { data: signedUrlData } = await supabase.storage
          .from("event-photos")
          .createSignedUrl(photo.image_url, 3600);

        if (signedUrlData?.signedUrl) {
          let blob: Blob;
          
          if (withFilter && filterType !== 'none') {
            blob = await applyFilterToCanvas(signedUrlData.signedUrl, filterType);
          } else {
            const response = await fetch(signedUrlData.signedUrl);
            blob = await response.blob();
          }
          
          const suffix = withFilter && filterType !== 'none' ? `-${filterType}` : '-original';
          const filename = `foto-${format(new Date(photo.captured_at), "dd-MM-yyyy-HHmm")}${suffix}.jpg`;
          zip.file(filename, blob);
        }
      }

      // Generate zip file
      const content = await zip.generateAsync({ type: "blob" });
      
      // Download zip
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      const suffix = withFilter && filterType !== 'none' ? `-${filterType}` : '-originales';
      a.download = `${eventName}-fotos${suffix}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      const completedText = language === "en" ? "Download complete" : language === "it" ? "Download completato" : "Descarga completada";
      const completedDescText = language === "en" 
        ? `${allPhotos?.length || 0} photos downloaded successfully`
        : language === "it"
        ? `${allPhotos?.length || 0} foto scaricate con successo`
        : `${allPhotos?.length || 0} fotos descargadas correctamente`;

      toast({
        title: completedText,
        description: completedDescText,
      });
    } catch (error) {
      console.error("Error downloading all photos:", error);
      toast({
        title: t.common.error,
        description: t.gallery.downloadError,
        variant: "destructive",
      });
    }
  };

  // Translated texts
  const totalText = language === "en" ? "Total" : language === "it" ? "Totale" : "Total";
  const loadingPhotosText = language === "en" ? "Loading photos..." : language === "it" ? "Caricamento foto..." : "Cargando fotos...";
  const noPhotosYetText = language === "en" ? "No photos yet" : language === "it" ? "Nessuna foto ancora" : "Aún no hay fotos";
  const photosAppearText = language === "en" ? "Photos will appear here when the reveal time is reached" : language === "it" ? "Le foto appariranno qui quando sarà raggiunta l'ora di rivelazione" : "Las fotos aparecerán aquí cuando se alcance la hora de revelado";
  const loadingMoreText = language === "en" ? "Loading more photos..." : language === "it" ? "Caricamento altre foto..." : "Cargando más fotos...";
  const shareText = language === "en" ? "Share" : language === "it" ? "Condividi" : "Compartir";
  const downloadAllText = language === "en" ? "Download all" : language === "it" ? "Scarica tutto" : "Descargar todo";
  const exitText = language === "en" ? "Exit" : language === "it" ? "Esci" : "Salir";
  const withFilterText = language === "en" ? "With filter" : language === "it" ? "Con filtro" : "Con filtro";
  const withoutFilterText = language === "en" ? "Without filter (original)" : language === "it" ? "Senza filtro (originale)" : "Sin filtro (original)";
  const downloadText = language === "en" ? "Download" : language === "it" ? "Scarica" : "Descargar";
  const deleteText = language === "en" ? "Delete" : language === "it" ? "Elimina" : "Eliminar";
  const viewPhotosText = language === "en" ? "View photos" : language === "it" ? "Vedi foto" : "Ver fotos";
  const photosRevealedText = language === "en" ? "Event photos have been revealed!" : language === "it" ? "Le foto dell'evento sono state rivelate!" : "¡Ya están las fotos del evento reveladas!";
  const enjoyText = language === "en" ? "Enjoy them" : language === "it" ? "Goditele" : "Disfrútalas";
  const playStoriesText = language === "en" ? "Play stories" : language === "it" ? "Riproduci stories" : "Reproducir stories";
  const enlargedPhotoText = language === "en" ? "Enlarged photo" : language === "it" ? "Foto ingrandita" : "Foto ampliada";

  // Expired event screen
  if (isExpired) {
    const expiredTitleText = language === "en" 
      ? "Photos available at another location" 
      : language === "it" 
      ? "Foto disponibili in un'altra posizione" 
      : "Las fotografías están disponibles en el siguiente enlace";
    const viewPhotosButtonText = language === "en" ? "View photos" : language === "it" ? "Vedi foto" : "Ver fotografías";

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full text-center space-y-6">
          <h1 
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: getEventFontFamily(eventFontFamily) }}
          >
            {eventName}
          </h1>
          <p className="text-lg text-muted-foreground">{expiredTitleText}</p>
          {expiryRedirectUrl && (
            <Button 
              size="lg" 
              onClick={() => window.open(expiryRedirectUrl, '_blank')}
              className="gap-2"
            >
              {viewPhotosButtonText}
            </Button>
          )}
          {/* Custom image below button */}
          {eventCustomImage && (
            <div className="pt-4">
              <img 
                src={eventCustomImage} 
                alt={eventName || "Event"} 
                className="max-w-[200px] max-h-[80px] object-contain mx-auto"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header with Background Image */}
      {eventBackgroundImage ? (
        <header className="relative w-full">
          {/* Background Image */}
          <div className="relative h-[50vh] min-h-[320px] max-h-[450px] w-full">
            <img
              src={eventBackgroundImage}
              alt={eventName || "Event"}
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
            
            {/* Menu Button - Top Right */}
            <div className="absolute top-4 right-4 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="icon" className="bg-background/80 backdrop-blur-sm hover:bg-background">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card">
                  <DropdownMenuItem onClick={() => setShowShareDialog(true)} className="cursor-pointer">
                    <Share2 className="w-4 h-4 mr-2" />
                    {shareText}
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <Download className="w-4 h-4 mr-2" />
                      {downloadAllText}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="bg-card">
                      {filterType !== 'none' && (
                        <DropdownMenuItem onClick={() => handleDownloadAll(true)} className="cursor-pointer">
                          {withFilterText}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDownloadAll(false)} className="cursor-pointer">
                        {filterType !== 'none' ? withoutFilterText : downloadAllText}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    {exitText}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* Event Info - Overlapping the gradient */}
          <div className="relative -mt-20 px-6 pb-0 text-center">
            <h1 
              className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2"
              style={{ fontFamily: getEventFontFamily(eventFontFamily) }}
            >
              {eventName}
            </h1>
            {eventDescription && (
              <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-2 whitespace-pre-line">{eventDescription}</p>
            )}
            {/* Custom image below description */}
            {eventCustomImage && (
              <div className="flex justify-center py-3">
                <img 
                  src={eventCustomImage} 
                  alt={eventName || "Event"} 
                  className="max-w-[200px] max-h-[80px] object-contain"
                />
              </div>
            )}
            <p className="text-sm text-muted-foreground tracking-wide">
              {language === "en" ? `✨ ${totalPhotos} photos have been revealed` : language === "it" ? `✨ Sono state rivelate ${totalPhotos} foto` : `✨ Se han revelado ${totalPhotos} fotos`}
            </p>
          </div>
        </header>
      ) : (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card">
          <div className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
            <div className="flex-1">
              <h1 
                className="text-3xl font-bold tracking-tight text-foreground"
                style={{ fontFamily: getEventFontFamily(eventFontFamily) }}
              >
                {eventName}
              </h1>
              {eventDescription && (
                <p className="text-muted-foreground text-sm mt-1 max-w-md whitespace-pre-line">{eventDescription}</p>
              )}
              {/* Custom image below description */}
              {eventCustomImage && (
                <div className="flex py-2">
                  <img 
                    src={eventCustomImage} 
                    alt={eventName || "Event"} 
                    className="max-w-[150px] max-h-[60px] object-contain"
                  />
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-2 tracking-wide">
                {language === "en" ? `✨ ${totalPhotos} photos have been revealed` : language === "it" ? `✨ Sono state rivelate ${totalPhotos} foto` : `✨ Se han revelado ${totalPhotos} fotos`}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card">
                <DropdownMenuItem onClick={() => setShowShareDialog(true)} className="cursor-pointer">
                  <Share2 className="w-4 h-4 mr-2" />
                  {shareText}
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer">
                    <Download className="w-4 h-4 mr-2" />
                    {downloadAllText}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-card">
                    {filterType !== 'none' && (
                      <DropdownMenuItem onClick={() => handleDownloadAll(true)} className="cursor-pointer">
                        {withFilterText}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleDownloadAll(false)} className="cursor-pointer">
                      {filterType !== 'none' ? withoutFilterText : downloadAllText}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  {exitText}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
      )}

      <main className={eventBackgroundImage ? "pt-4 pb-20" : "py-12 pt-36 pb-20"}>
        <div className="max-w-7xl mx-auto px-6">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <p className="text-muted-foreground uppercase tracking-wide">{loadingPhotosText}</p>
            </div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
              <Film className="w-16 h-16 text-muted-foreground" />
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground uppercase tracking-tight">
                  {noPhotosYetText}
                </h2>
                <p className="text-muted-foreground text-sm tracking-wide">
                  {photosAppearText}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative bg-muted"
              >
                <div 
                  className={`aspect-square overflow-hidden bg-muted relative ${getGrainClass(filterType)} cursor-pointer`}
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <img
                    src={(photo as any).thumbnailUrl}
                    alt={language === "en" ? "Event photo" : language === "it" ? "Foto evento" : "Foto del evento"}
                    className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${getFilterClass(filterType)}`}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-muted animate-pulse" style={{ zIndex: -1 }} />
                  
                  {/* Popularity bar - top overlay */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-black/30 overflow-hidden pointer-events-none">
                    <div 
                      className="h-full bg-like transition-all duration-500 ease-out"
                      style={{ 
                        width: `${Math.min(100, ((photo.likeCount || 0) / 10) * 100)}%` 
                      }}
                    />
                  </div>
                  
                  {/* Date - bottom left */}
                  <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs pointer-events-none">
                    {formatLocalDate(photo.captured_at, "dd/MM/yyyy HH:mm")}
                  </div>
                  
                  {/* Like button - bottom right */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLikePhoto(photo.id);
                    }}
                    disabled={photo.hasLiked}
                    className="absolute bottom-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors disabled:opacity-50"
                  >
                    <img 
                      src={photo.hasLiked ? heartFilled : heartOutline}
                      alt="like"
                      className="w-5 h-5"
                    />
                  </button>
                </div>
              </div>
                ))}
              </div>
              {hasMore && (
                <div ref={observerTarget} className="flex justify-center py-8">
                  <p className="text-muted-foreground uppercase tracking-wide text-sm">
                    {loadingMoreText}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Floating Play Stories Button */}
      {totalPhotos > 0 && (
        <button
          onClick={handleOpenStories}
          disabled={loadingStories}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-like text-white shadow-sm hover:bg-like/90 transition-all flex items-center justify-center disabled:opacity-50"
          aria-label={playStoriesText}
        >
          {loadingStories ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Play className="w-6 h-6 fill-white" />
          )}
        </button>
      )}

      {/* Welcome confetti effect is triggered but no modal is shown */}

      {/* Share Dialog */}
      {eventPassword && (
               <ShareDialog
                 eventPassword={eventPassword}
                 eventName={eventName || ""}
                 open={showShareDialog}
                 onOpenChange={setShowShareDialog}
                 isRevealed={true}
                 language={language}
               />
      )}

      {/* Photo Detail Modal */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl p-6 bg-card">
          {selectedPhoto && (
            <div className="space-y-4">
              <div className={`relative ${getGrainClass(filterType)}`}>
                <img
                  src={(selectedPhoto as any).fullQualityUrl}
                  alt={enlargedPhotoText}
                  className={`w-full h-auto max-h-[70vh] object-contain ${getFilterClass(filterType)} rounded-lg`}
                  onError={(e) => {
                    e.currentTarget.src = (selectedPhoto as any).thumbnailUrl;
                  }}
                />
                
                {/* Popularity bar - top overlay */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-black/30 overflow-hidden rounded-t-lg pointer-events-none">
                  <div 
                    className="h-full bg-like transition-all duration-500 ease-out"
                    style={{ 
                      width: `${Math.min(100, ((selectedPhoto.likeCount || 0) / 10) * 100)}%` 
                    }}
                  />
                </div>
                
                {/* Like button - bottom right */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLikePhoto(selectedPhoto.id);
                  }}
                  disabled={selectedPhoto.hasLiked}
                  className="absolute bottom-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors disabled:opacity-50"
                >
                  <img 
                    src={selectedPhoto.hasLiked ? heartFilled : heartOutline}
                    alt="like"
                    className="w-6 h-6"
                  />
                </button>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <p className="text-foreground text-sm uppercase tracking-wider">
                  {formatLocalDate(selectedPhoto.captured_at, "dd MMM yyyy - HH:mm")}
                </p>
                <div className="flex gap-2">
                  {filterType !== 'none' ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="sm" className="uppercase tracking-wide flex-1">
                          <Download className="w-4 h-4 mr-2" />
                          {downloadText}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-card">
                        <DropdownMenuItem onClick={() => handleDownloadPhoto((selectedPhoto as any).fullQualityUrl, selectedPhoto.captured_at, true)} className="cursor-pointer">
                          {withFilterText}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadPhoto((selectedPhoto as any).fullQualityUrl, selectedPhoto.captured_at, false)} className="cursor-pointer">
                          {withoutFilterText}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownloadPhoto((selectedPhoto as any).fullQualityUrl, selectedPhoto.captured_at, false)}
                      className="uppercase tracking-wide flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {downloadText}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDeletePhoto(selectedPhoto.id, selectedPhoto.image_url)}
                    className="uppercase tracking-wide flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleteText}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stories Viewer */}
      {showStories && (
        <StoriesViewer
          photos={allPhotosForStories}
          eventName={eventName || ""}
          eventDescription={eventDescription}
          backgroundImage={eventBackgroundImage}
          totalPhotos={totalPhotos}
          filterType={filterType}
          fontFamily={eventFontFamily}
          language={language}
          onClose={() => setShowStories(false)}
          onLikePhoto={handleLikePhoto}
        />
      )}
    </div>
  );
};

export default Gallery;