import { useState, useEffect } from "react";
import { X } from "lucide-react";
import heartOutline from "@/assets/heart-outline.svg";
import heartFilled from "@/assets/heart-filled.svg";
import { FilterType, getFilterClass, getGrainClass } from "@/lib/photoFilters";
import { EventFontFamily, getEventFontFamily } from "@/lib/eventFonts";

type StoryMediaType = "photo" | "video" | "audio";

interface StoryItem {
  id: string;
  type: StoryMediaType;
  captured_at: string;
  thumbnailUrl?: string;
  fullQualityUrl?: string;
  signedUrl?: string;
  likeCount?: number;
  hasLiked?: boolean;
}

interface StoriesViewerProps {
  items: StoryItem[];
  eventName: string;
  eventDescription: string | null;
  backgroundImage: string | null;
  totalItems: number;
  filterType: FilterType;
  fontFamily?: EventFontFamily;
  language: "es" | "en" | "it";
  onClose: () => void;
  onLikeMedia: (item: StoryItem) => void;
}

const StoriesViewer = ({
  items,
  eventName,
  eventDescription,
  backgroundImage,
  totalItems,
  filterType,
  fontFamily = "system",
  language,
  onClose,
  onLikeMedia,
}: StoriesViewerProps) => {
  // Index 0 = cover slide, 1+ = photos
  const [currentIndex, setCurrentIndex] = useState(0);
  const totalSlides = items.length + 1; // +1 for cover

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;

    if (clickX < width / 3) {
      // Left third - go back
      if (currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    } else {
      // Right two-thirds - go forward
      if (currentIndex < totalSlides - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // End of stories
        onClose();
      }
    }
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (e.key === "ArrowRight" && currentIndex < totalSlides - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, totalSlides, onClose]);

  // Prevent body scroll when stories are open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const currentItem = currentIndex > 0 ? items[currentIndex - 1] : null;

  const itemsText = language === "en" 
    ? `${totalItems} media` 
    : language === "it" 
    ? `${totalItems} elementi` 
    : `${totalItems} elementos`;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Progress bars */}
      <div className="absolute top-2 left-2 right-2 z-20 flex gap-1">
        {Array.from({ length: totalSlides }).map((_, idx) => (
          <div
            key={idx}
            className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden"
          >
            <div
              className={`h-full bg-white transition-all duration-300 ${
                idx < currentIndex ? "w-full" : idx === currentIndex ? "w-full" : "w-0"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-8 right-4 z-20 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Main content area - clickable */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={handleClick}
      >
        {currentIndex === 0 ? (
          // Cover slide
          <div className="relative w-full h-full">
            {backgroundImage ? (
              <img
                src={backgroundImage}
                alt={eventName}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-muted" />
            )}
            {/* White solid overlay at 85% opacity */}
            <div className="absolute inset-0 bg-white/85" />
            
            {/* Event info */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-24 px-6 text-center">
              <h1 
                className="text-4xl md:text-5xl font-bold text-foreground mb-3"
                style={{ fontFamily: getEventFontFamily(fontFamily) }}
              >
                {eventName}
              </h1>
              {eventDescription && (
                <p className="text-muted-foreground text-lg md:text-xl max-w-md mb-4 whitespace-pre-line">
                  {eventDescription}
                </p>
              )}
              <p className="text-sm text-muted-foreground uppercase tracking-widest">
                ✨ {itemsText}
              </p>
            </div>
          </div>
        ) : currentItem ? (
          <div className={`relative w-full h-full flex items-center justify-center ${currentItem.type === "photo" ? getGrainClass(filterType) : ""}`}>
            {currentItem.type === "photo" ? (
              <img
                src={currentItem.fullQualityUrl || currentItem.thumbnailUrl}
                alt={language === "en" ? "Event photo" : language === "it" ? "Foto evento" : "Foto del evento"}
                className={`max-w-full max-h-full object-contain ${getFilterClass(filterType)}`}
              />
            ) : currentItem.type === "video" ? (
              <video
                src={currentItem.signedUrl || ""}
                controls
                autoPlay
                playsInline
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-6">
                <div className="w-full max-w-xl rounded-2xl bg-red-950/90 p-6">
                  <audio src={currentItem.signedUrl || ""} controls autoPlay className="w-full" />
                </div>
              </div>
            )}
            
            {/* Like button - bottom right */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLikeMedia(currentItem);
              }}
              disabled={currentItem.hasLiked}
              className="absolute bottom-8 right-4 p-3 rounded-full bg-black/50 hover:bg-black/70 transition-colors disabled:opacity-50"
            >
              <img
                src={currentItem.hasLiked ? heartFilled : heartOutline}
                alt="like"
                className="w-8 h-8"
              />
            </button>

            {/* Item counter */}
            <div className="absolute bottom-8 left-4 px-3 py-1 rounded-full bg-black/50 text-white text-sm">
              {currentIndex} / {items.length}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default StoriesViewer;
