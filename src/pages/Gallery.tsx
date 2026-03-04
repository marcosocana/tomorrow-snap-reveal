import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Film, Trash2, Download, MoreVertical, Share2, Play, Image, Mic, Video, LayoutGrid, LayoutList } from "lucide-react";
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
import { getDeviceId } from "@/lib/deviceId";

interface Photo {
  id: string;
  image_url: string;
  captured_at: string;
  thumbnailUrl?: string;
  fullQualityUrl?: string;
  likeCount?: number;
  hasLiked?: boolean;
}

interface VideoItem {
  id: string;
  video_url: string;
  captured_at: string;
  duration_seconds?: number | null;
  signedUrl?: string;
  likeCount?: number;
  hasLiked?: boolean;
}

interface AudioItem {
  id: string;
  audio_url: string;
  captured_at: string;
  duration_seconds?: number | null;
  signedUrl?: string;
  likeCount?: number;
  hasLiked?: boolean;
}

type MixedMediaType = "photo" | "video" | "audio";

interface MixedMediaItem {
  id: string;
  type: MixedMediaType;
  captured_at: string;
  duration_seconds?: number | null;
  thumbnailUrl?: string;
  fullQualityUrl?: string;
  signedUrl?: string;
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
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [audios, setAudios] = useState<AudioItem[]>([]);
  const [totalVideos, setTotalVideos] = useState(0);
  const [totalAudios, setTotalAudios] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MixedMediaItem | null>(null);
  
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
  const [storyItems, setStoryItems] = useState<MixedMediaItem[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [expiryRedirectUrl, setExpiryRedirectUrl] = useState<string | null>(null);
  const [eventFontFamily, setEventFontFamily] = useState<EventFontFamily>("system");
  const [eventFontSize, setEventFontSize] = useState<string>("text-3xl");
  const [allowPhotoDeletion, setAllowPhotoDeletion] = useState<boolean>(true);
  const [allowPhotoSharing, setAllowPhotoSharing] = useState<boolean>(true);
  const [galleryViewMode, setGalleryViewMode] = useState<"normal" | "grid">("normal");
  const [likeCountingEnabled, setLikeCountingEnabled] = useState<boolean>(false);
  const [allowVideoRecording, setAllowVideoRecording] = useState(false);
  const [allowAudioRecording, setAllowAudioRecording] = useState(false);
  const [headerStyle, setHeaderStyle] = useState<"gradient" | "modern">("modern");

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
                width: 560,
                height: 560,
                quality: 75
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

  const loadVideos = useCallback(async () => {
    if (!eventId) return;
    try {
      const { data, error } = await supabase
        .from("videos")
        .select("id,video_url,captured_at,duration_seconds")
        .eq("event_id", eventId)
        .order("captured_at", { ascending: true });
      if (error) throw error;

      const videoIds = (data || []).map((v) => v.id);
      const { data: likesData } = await supabase
        .from("video_likes" as any)
        .select("video_id")
        .in("video_id", videoIds);

      const likeCounts = (likesData || []).reduce((acc: any, like: any) => {
        acc[like.video_id] = (acc[like.video_id] || 0) + 1;
        return acc;
      }, {});
      const likedVideos = JSON.parse(localStorage.getItem("likedVideos") || "[]");

      const enriched = await Promise.all(
        (data || []).map(async (video) => {
          const { data: signedData } = await supabase.storage
            .from("event-videos")
            .createSignedUrl(video.video_url, 3600);
          return {
            ...video,
            signedUrl: signedData?.signedUrl || "",
            likeCount: likeCounts[video.id] || 0,
            hasLiked: likedVideos.includes(video.id),
          };
        })
      );

      setVideos(enriched as VideoItem[]);
      setTotalVideos((enriched || []).length);
    } catch (error) {
      console.error("Error loading videos:", error);
    }
  }, [eventId]);

  const loadAudios = useCallback(async () => {
    if (!eventId) return;
    try {
      const { data, error } = await supabase
        .from("audios")
        .select("id,audio_url,captured_at,duration_seconds")
        .eq("event_id", eventId)
        .order("captured_at", { ascending: true });
      if (error) throw error;

      const audioIds = (data || []).map((a) => a.id);
      const { data: likesData } = await supabase
        .from("audio_likes" as any)
        .select("audio_id")
        .in("audio_id", audioIds);

      const likeCounts = (likesData || []).reduce((acc: any, like: any) => {
        acc[like.audio_id] = (acc[like.audio_id] || 0) + 1;
        return acc;
      }, {});
      const likedAudios = JSON.parse(localStorage.getItem("likedAudios") || "[]");

      const enriched = await Promise.all(
        (data || []).map(async (audio) => {
          const { data: signedData } = await supabase.storage
            .from("event-audios")
            .createSignedUrl(audio.audio_url, 3600);
          return {
            ...audio,
            signedUrl: signedData?.signedUrl || "",
            likeCount: likeCounts[audio.id] || 0,
            hasLiked: likedAudios.includes(audio.id),
          };
        })
      );

      setAudios(enriched as AudioItem[]);
      setTotalAudios((enriched || []).length);
    } catch (error) {
      console.error("Error loading audio notes:", error);
    }
  }, [eventId]);

  const mixedMedia = useMemo(() => {
    const items: MixedMediaItem[] = [];
    photos.forEach((photo) => {
      items.push({
        type: "photo",
        id: photo.id,
        captured_at: photo.captured_at,
        thumbnailUrl: (photo as any).thumbnailUrl,
        fullQualityUrl: (photo as any).fullQualityUrl,
        likeCount: photo.likeCount || 0,
        hasLiked: !!photo.hasLiked,
      });
    });
    videos.forEach((video) => {
      items.push({
        type: "video",
        id: video.id,
        captured_at: video.captured_at,
        duration_seconds: video.duration_seconds,
        signedUrl: video.signedUrl,
        likeCount: video.likeCount || 0,
        hasLiked: !!video.hasLiked,
      });
    });
    audios.forEach((audio) => {
      items.push({
        type: "audio",
        id: audio.id,
        captured_at: audio.captured_at,
        duration_seconds: audio.duration_seconds,
        signedUrl: audio.signedUrl,
        likeCount: audio.likeCount || 0,
        hasLiked: !!audio.hasLiked,
      });
    });
    return items.sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime());
  }, [audios, photos, videos]);

  const photoLookup = useMemo(() => {
    const map = new Map<string, Photo>();
    photos.forEach((photo) => map.set(photo.id, photo));
    return map;
  }, [photos]);

  const handleMediaClick = useCallback(
    (item: MixedMediaItem) => {
      if (item.type === "photo") {
        const photo = photoLookup.get(item.id);
        if (photo) {
          setSelectedPhoto(photo);
        }
        return;
      }
      setSelectedMedia(item);
    },
    [photoLookup]
  );

  const renderAudioWaveform = (compact: boolean) => {
    const bars = compact ? 10 : 22;
    return (
      <div className="absolute inset-0 flex items-center justify-center gap-1 px-4">
        {Array.from({ length: bars }).map((_, index) => {
          const height = 20 + ((index * 13) % 38);
          return (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="w-1 rounded-full bg-red-500/90"
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>
    );
  };

  const renderMediaPreview = (item: MixedMediaItem, view: "grid" | "list") => {
    if (item.type === "photo") {
      return (
        <img
          src={item.thumbnailUrl || (item as any).fullQualityUrl}
          alt={language === "en" ? "Event photo" : language === "it" ? "Foto evento" : "Foto del evento"}
          className={`w-full h-full object-cover ${getFilterClass(filterType)} transition-transform duration-300 ${
            view === "list" ? "group-hover:scale-105" : ""
          }`}
          loading="lazy"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      );
    }
    if (item.type === "video") {
      return (
        <div className="relative h-full w-full bg-black">
          <video
            src={item.signedUrl || ""}
            muted
            playsInline
            autoPlay={view === "grid"}
            loop={view === "grid"}
            className="w-full h-full object-cover bg-black"
          />
        </div>
      );
    }
    return (
      <div className="relative h-full w-full bg-red-950/90">
        {renderAudioWaveform(view === "grid")}
      </div>
    );
  };

  useEffect(() => {
    if (!eventId) {
      navigate("/");
      return;
    }

    // Load event password, filter type, custom image, description, background, expiry and sharing settings
    const loadEventData = async () => {
      const { data } = await supabase
        .from("events")
      .select("password_hash, filter_type, custom_image_url, description, background_image_url, expiry_date, expiry_redirect_url, font_family, font_size, allow_photo_deletion, allow_photo_sharing, like_counting_enabled, allow_video_recording, allow_audio_recording, header_style")
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
        setAllowPhotoDeletion((data as any).allow_photo_deletion !== false);
        setAllowPhotoSharing((data as any).allow_photo_sharing !== false);
        setAllowVideoRecording((data as any).allow_video_recording === true);
        setAllowAudioRecording((data as any).allow_audio_recording === true);
        setHeaderStyle(((data as any).header_style || "modern") as "gradient" | "modern");
        // Revealed gallery must start in normal mode. User can switch to grid manually.
        setGalleryViewMode("normal");
        setLikeCountingEnabled((data as any).like_counting_enabled === true);
        
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

    // Trigger confetti every time gallery loads
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

    loadPhotos(0);
    loadVideos();
    loadAudios();
  }, [eventId, navigate, loadPhotos, loadVideos, loadAudios]);

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
      const deviceId = getDeviceId();
      
      // Check if already liked by this device
      const { data: existingLike } = await supabase
        .from("photo_likes")
        .select("id")
        .eq("photo_id", photoId)
        .eq("device_id", deviceId)
        .maybeSingle();
      
      if (existingLike) {
        return; // Already liked from this device
      }

      // Add like to database with device_id
      const { error } = await supabase
        .from("photo_likes")
        .insert({ photo_id: photoId, device_id: deviceId });

      if (error) throw error;

      // Update localStorage for backward compatibility
      const likedPhotos = JSON.parse(localStorage.getItem("likedPhotos") || "[]");
      if (!likedPhotos.includes(photoId)) {
        likedPhotos.push(photoId);
        localStorage.setItem("likedPhotos", JSON.stringify(likedPhotos));
      }

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

  const handleLikeVideo = async (videoId: string) => {
    try {
      const deviceId = getDeviceId();
      const { data: existingLike } = await supabase
        .from("video_likes" as any)
        .select("id")
        .eq("video_id", videoId)
        .eq("device_id", deviceId)
        .maybeSingle();
      if (existingLike) return;

      const { error } = await supabase
        .from("video_likes" as any)
        .insert({ video_id: videoId, device_id: deviceId });
      if (error) throw error;

      const likedVideos = JSON.parse(localStorage.getItem("likedVideos") || "[]");
      if (!likedVideos.includes(videoId)) {
        likedVideos.push(videoId);
        localStorage.setItem("likedVideos", JSON.stringify(likedVideos));
      }

      setVideos((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, likeCount: (v.likeCount || 0) + 1, hasLiked: true } : v))
      );
      setSelectedMedia((prev) =>
        prev && prev.type === "video" && prev.id === videoId
          ? { ...prev, likeCount: (prev.likeCount || 0) + 1, hasLiked: true }
          : prev
      );
    } catch (error) {
      console.error("Error liking video:", error);
    }
  };

  const handleLikeAudio = async (audioId: string) => {
    try {
      const deviceId = getDeviceId();
      const { data: existingLike } = await supabase
        .from("audio_likes" as any)
        .select("id")
        .eq("audio_id", audioId)
        .eq("device_id", deviceId)
        .maybeSingle();
      if (existingLike) return;

      const { error } = await supabase
        .from("audio_likes" as any)
        .insert({ audio_id: audioId, device_id: deviceId });
      if (error) throw error;

      const likedAudios = JSON.parse(localStorage.getItem("likedAudios") || "[]");
      if (!likedAudios.includes(audioId)) {
        likedAudios.push(audioId);
        localStorage.setItem("likedAudios", JSON.stringify(likedAudios));
      }

      setAudios((prev) =>
        prev.map((a) => (a.id === audioId ? { ...a, likeCount: (a.likeCount || 0) + 1, hasLiked: true } : a))
      );
      setSelectedMedia((prev) =>
        prev && prev.type === "audio" && prev.id === audioId
          ? { ...prev, likeCount: (prev.likeCount || 0) + 1, hasLiked: true }
          : prev
      );
    } catch (error) {
      console.error("Error liking audio:", error);
    }
  };

  const handleLikeMedia = (item: MixedMediaItem) => {
    if (item.type === "photo") {
      handleLikePhoto(item.id);
      return;
    }
    if (item.type === "video") {
      handleLikeVideo(item.id);
      return;
    }
    handleLikeAudio(item.id);
  };

  const handleOpenStories = async () => {
    if (!eventId) return;
    
    setLoadingStories(true);
    try {
      const [{ data: allPhotos, error: photosError }, { data: allVideos, error: videosError }, { data: allAudios, error: audiosError }] = await Promise.all([
        supabase
        .from("photos")
        .select("*")
        .eq("event_id", eventId)
        .order("captured_at", { ascending: true }),
        supabase
          .from("videos")
          .select("id,video_url,captured_at,duration_seconds")
          .eq("event_id", eventId)
          .order("captured_at", { ascending: true }),
        supabase
          .from("audios")
          .select("id,audio_url,captured_at,duration_seconds")
          .eq("event_id", eventId)
          .order("captured_at", { ascending: true }),
      ]);

      if (photosError) throw photosError;
      if (videosError) throw videosError;
      if (audiosError) throw audiosError;

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
      const likedVideos = JSON.parse(localStorage.getItem("likedVideos") || "[]");
      const likedAudios = JSON.parse(localStorage.getItem("likedAudios") || "[]");

      const videoIds = (allVideos || []).map((v) => v.id);
      const { data: videoLikesData } = await supabase
        .from("video_likes" as any)
        .select("video_id")
        .in("video_id", videoIds);
      const videoLikeCounts = (videoLikesData || []).reduce((acc: any, like: any) => {
        acc[like.video_id] = (acc[like.video_id] || 0) + 1;
        return acc;
      }, {});

      const audioIds = (allAudios || []).map((a) => a.id);
      const { data: audioLikesData } = await supabase
        .from("audio_likes" as any)
        .select("audio_id")
        .in("audio_id", audioIds);
      const audioLikeCounts = (audioLikesData || []).reduce((acc: any, like: any) => {
        acc[like.audio_id] = (acc[like.audio_id] || 0) + 1;
        return acc;
      }, {});

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
            type: "photo" as const,
          };
        })
      );

      const videosWithUrls = await Promise.all(
        (allVideos || []).map(async (video) => {
          const { data: signedData } = await supabase.storage
            .from("event-videos")
            .createSignedUrl(video.video_url, 3600);
          return {
            ...video,
            signedUrl: signedData?.signedUrl || "",
            likeCount: videoLikeCounts[video.id] || 0,
            hasLiked: likedVideos.includes(video.id),
            type: "video" as const,
          };
        })
      );

      const audiosWithUrls = await Promise.all(
        (allAudios || []).map(async (audio) => {
          const { data: signedData } = await supabase.storage
            .from("event-audios")
            .createSignedUrl(audio.audio_url, 3600);
          return {
            ...audio,
            signedUrl: signedData?.signedUrl || "",
            likeCount: audioLikeCounts[audio.id] || 0,
            hasLiked: likedAudios.includes(audio.id),
            type: "audio" as const,
          };
        })
      );

      const mixedStories = [...photosWithUrls, ...videosWithUrls, ...audiosWithUrls].sort(
        (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
      );

      setStoryItems(mixedStories as MixedMediaItem[]);
      setShowStories(true);
    } catch (error) {
      console.error("Error loading stories media:", error);
      toast({
        title: t.common.error,
        description: language === "en" ? "Error loading media" : language === "it" ? "Errore nel caricamento dei contenuti" : "Error al cargar el contenido",
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

  const handleSharePhoto = async (signedUrl: string) => {
    try {
      const shareTitle = language === "en" 
        ? `Photo from ${eventName}` 
        : language === "it" 
        ? `Foto da ${eventName}` 
        : `Foto de ${eventName}`;
      
      const shareText = language === "en"
        ? `Check out this photo from ${eventName}!`
        : language === "it"
        ? `Guarda questa foto da ${eventName}!`
        : `¡Mira esta foto de ${eventName}!`;

      // First try to share the image file directly (works better for Instagram, etc.)
      if (navigator.share) {
        try {
          // Fetch the image and create a blob
          const response = await fetch(signedUrl);
          const blob = await response.blob();
          const file = new File([blob], `foto-${eventName}.jpg`, { type: 'image/jpeg' });
          
          // Check if file sharing is supported
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: shareTitle,
              text: shareText,
              files: [file],
            });
            return;
          }
        } catch (fileShareError) {
          console.log("File sharing not available, falling back to URL share");
        }
        
        // Fallback to sharing URL only
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: signedUrl,
        });
      } else {
        // Fallback: copy URL to clipboard
        await navigator.clipboard.writeText(signedUrl);
        const copiedText = language === "en" ? "Link copied" : language === "it" ? "Link copiato" : "Enlace copiado";
        const copiedDescText = language === "en" 
          ? "Photo link copied to clipboard" 
          : language === "it" 
          ? "Link della foto copiato negli appunti" 
          : "Enlace de la foto copiado al portapapeles";
        toast({
          title: copiedText,
          description: copiedDescText,
        });
      }
    } catch (error) {
      // User cancelled share or error occurred
      if ((error as Error).name !== 'AbortError') {
        console.error("Error sharing photo:", error);
      }
    }
  };

  const handleShareMedia = async (signedUrl: string, type: MixedMediaType) => {
    try {
      const label = type === "photo" ? "photo" : type === "video" ? "video" : "audio";
      const shareTitle = language === "en"
        ? `${label} from ${eventName}`
        : language === "it"
        ? `${label} da ${eventName}`
        : `${label} de ${eventName}`;
      const shareText = language === "en"
        ? `Check out this ${label} from ${eventName}!`
        : language === "it"
        ? `Guarda questo ${label} da ${eventName}!`
        : `¡Mira este ${label} de ${eventName}!`;

      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: signedUrl,
        });
      } else {
        await navigator.clipboard.writeText(signedUrl);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing media:", error);
      }
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
  const sharePhotoText = language === "en" ? "Share" : language === "it" ? "Condividi" : "Compartir";
  const viewPhotosText = language === "en" ? "View photos" : language === "it" ? "Vedi foto" : "Ver fotos";
  const playStoriesText = language === "en" ? "Play stories" : language === "it" ? "Riproduci stories" : "Reproducir stories";
  const enlargedPhotoText = language === "en" ? "Enlarged photo" : language === "it" ? "Foto ingrandita" : "Foto ampliada";
  const photoCount = totalPhotos;
  const videoCount = totalVideos;
  const audioCount = totalAudios;

  const mediaStatsText =
    language === "en"
      ? `📷 ${totalPhotos} photos / 📹 ${totalVideos} videos / 🔈 ${totalAudios} audios`
      : language === "it"
      ? `📷 ${totalPhotos} foto / 📹 ${totalVideos} video / 🔈 ${totalAudios} audio`
      : `📷 ${totalPhotos} fotos / 📹 ${totalVideos} vídeos / 🔈 ${totalAudios} audios`;
  const videosLabel = language === "en" ? "Videos" : language === "it" ? "Video" : "Vídeos";
  const audioLabel = language === "en" ? "Audio notes" : language === "it" ? "Note audio" : "Notas de audio";
  const hasOnlyPhotos = totalVideos === 0 && totalAudios === 0;
  const revealedTitleText = hasOnlyPhotos
    ? language === "en"
      ? `✨ ${totalPhotos} photos have been revealed`
      : language === "it"
      ? `✨ Sono state rivelate ${totalPhotos} foto`
      : `✨ Se han revelado ${totalPhotos} fotos`
    : language === "en"
    ? "✨ Event media has been revealed"
    : language === "it"
    ? "✨ I contenuti dell'evento sono stati rivelati"
    : "✨ Ya se ha revelado el contenido del evento";
  const isModernHeader = headerStyle === "modern";

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
            <div className={`absolute inset-0 ${isModernHeader ? "bg-black/65" : "bg-gradient-to-b from-transparent via-transparent to-background"}`} />
            
            {/* Menu Button - Top Right */}
            <div className="absolute top-4 right-4 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className={isModernHeader ? "bg-black/45 text-white backdrop-blur-sm hover:bg-black/60" : "bg-background/80 backdrop-blur-sm hover:bg-background"}
                  >
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
            {isModernHeader && (
              <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-6 text-left">
                <h1
                  className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2"
                  style={{ fontFamily: getEventFontFamily(eventFontFamily) }}
                >
                  {eventName}
                </h1>
                {eventDescription && (
                  <p className="text-white/90 text-base md:text-lg max-w-xl mb-2 whitespace-pre-line">{eventDescription}</p>
                )}
                {eventCustomImage && (
                  <div className="flex py-2">
                    <img
                      src={eventCustomImage}
                      alt={eventName || "Event"}
                      className="max-w-[180px] max-h-[72px] object-contain"
                    />
                  </div>
                )}
                <p className="text-sm text-white/90 tracking-wide">{revealedTitleText}</p>
                <p className="text-sm text-white/90 mt-1">{mediaStatsText}</p>
              </div>
            )}
          </div>
          {!isModernHeader && (
            <div className="relative -mt-20 px-6 pb-6 text-center">
              <h1
                className={`${eventFontSize} md:text-4xl font-bold tracking-tight text-foreground mb-2`}
                style={{ fontFamily: getEventFontFamily(eventFontFamily) }}
              >
                {eventName}
              </h1>
              {eventDescription && (
                <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-2 whitespace-pre-line">{eventDescription}</p>
              )}
              {eventCustomImage && (
                <div className="flex justify-center py-2">
                  <img
                    src={eventCustomImage}
                    alt={eventName || "Event"}
                    className="max-w-[180px] max-h-[72px] object-contain"
                  />
                </div>
              )}
              <p className="text-sm text-muted-foreground tracking-wide">{revealedTitleText}</p>
              <p className="text-sm text-muted-foreground mt-1">{mediaStatsText}</p>
            </div>
          )}
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
            <p className="text-sm text-muted-foreground mt-2 tracking-wide">{revealedTitleText}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {mediaStatsText}
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
          <div className="mb-4">
            <div className="mx-auto flex w-full max-w-2xl rounded-2xl bg-muted p-1">
            {(["normal", "grid"] as const).map((mode) => {
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGalleryViewMode(mode)}
                  className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    galleryViewMode === mode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={`${mode} view`}
                >
                  {mode === "normal" ? <LayoutList className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                </button>
              );
            })}
            </div>
          </div>
        </div>
        <div className={galleryViewMode === "grid" ? "w-full" : "max-w-7xl mx-auto px-6"}>
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <p className="text-muted-foreground uppercase tracking-wide">{loadingPhotosText}</p>
            </div>
          ) : mixedMedia.length === 0 ? (
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
          ) : galleryViewMode === "grid" ? (
            <div className="px-0">
              <div className="grid grid-cols-3 gap-2 bg-white">
                {mixedMedia.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onClick={() => handleMediaClick(item)}
                    className="group relative aspect-square cursor-pointer overflow-hidden bg-muted outline-none focus-visible:ring focus-visible:ring-primary/60"
                  >
                    {renderMediaPreview(item, "grid")}
                    {item.type === "video" || item.type === "audio" ? (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white">
                          <Play className="h-5 w-5 fill-white" />
                        </span>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLikeMedia(item);
                      }}
                      disabled={item.hasLiked}
                      className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 disabled:opacity-50"
                    >
                      <img src={item.hasLiked ? heartFilled : heartOutline} alt="like" className="h-4 w-4" />
                    </button>
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
                      {item.likeCount || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 pb-6">
              {mixedMedia.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="relative overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => handleMediaClick(item)}
                    className="group relative block w-full overflow-hidden rounded-2xl outline-none focus-visible:ring focus-visible:ring-primary/60"
                  >
                    {renderMediaPreview(item, "list")}
                    {item.type === "video" || item.type === "audio" ? (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white transition group-hover:scale-105">
                          <Play className="h-6 w-6 fill-white" />
                        </span>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLikeMedia(item);
                      }}
                      disabled={item.hasLiked}
                      className="absolute right-3 top-3 rounded-full bg-black/50 p-2 disabled:opacity-50"
                    >
                      <img src={item.hasLiked ? heartFilled : heartOutline} alt="like" className="h-5 w-5" />
                    </button>
                    <span className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">
                      {item.likeCount || 0}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
          {hasMore && (
            <div ref={observerTarget} className="flex justify-center py-8">
              <p className="text-muted-foreground uppercase tracking-wide text-sm">
                {loadingMoreText}
              </p>
            </div>
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
                 eventId={eventId}
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
                <div className="flex gap-2">
                  {filterType !== 'none' ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="sm" className="uppercase tracking-wide flex-1">
                          <Download className="w-4 h-4 sm:mr-2" />
                          <span className="hidden sm:inline">{downloadText}</span>
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
                      <Download className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">{downloadText}</span>
                    </Button>
                  )}
                  {allowPhotoDeletion && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDeletePhoto(selectedPhoto.id, selectedPhoto.image_url)}
                      className="uppercase tracking-wide flex-1"
                    >
                      <Trash2 className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">{deleteText}</span>
                    </Button>
                  )}
                  {allowPhotoSharing && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSharePhoto((selectedPhoto as any).fullQualityUrl)}
                      className="uppercase tracking-wide flex-1"
                    >
                      <Share2 className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">{sharePhotoText}</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Media Detail Modal (Video/Audio) */}
      <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
        <DialogContent className="max-w-4xl p-6 bg-card">
          {selectedMedia ? (
            <div className="space-y-4">
              {selectedMedia.type === "video" ? (
                <video
                  src={selectedMedia.signedUrl || ""}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-auto max-h-[70vh] rounded-lg bg-black object-contain"
                />
              ) : (
                <div className="space-y-3">
                  <div className="relative h-44 w-full overflow-hidden rounded-lg bg-red-950/90">
                    {renderAudioWaveform(false)}
                  </div>
                  <audio src={selectedMedia.signedUrl || ""} controls autoPlay className="w-full" />
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleLikeMedia(selectedMedia)}
                  disabled={selectedMedia.hasLiked}
                  className="uppercase tracking-wide flex-1"
                >
                  <img src={selectedMedia.hasLiked ? heartFilled : heartOutline} alt="like" className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{selectedMedia.likeCount || 0}</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleShareMedia(selectedMedia.signedUrl || "", selectedMedia.type)}
                  className="uppercase tracking-wide flex-1"
                >
                  <Share2 className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{sharePhotoText}</span>
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Stories Viewer */}
      {showStories && (
        <StoriesViewer
          items={storyItems}
          eventName={eventName || ""}
          eventDescription={eventDescription}
          backgroundImage={eventBackgroundImage}
          totalItems={storyItems.length}
          filterType={filterType}
          fontFamily={eventFontFamily}
          language={language}
          onClose={() => setShowStories(false)}
          onLikeMedia={handleLikeMedia}
        />
      )}
    </div>
  );
};

export default Gallery;
