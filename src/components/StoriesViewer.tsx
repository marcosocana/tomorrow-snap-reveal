import { useState, useEffect } from "react";
import { X } from "lucide-react";
import heartOutline from "@/assets/heart-outline.svg";
import heartFilled from "@/assets/heart-filled.svg";
import { FilterType, getFilterClass, getGrainClass } from "@/lib/photoFilters";

interface Photo {
  id: string;
  thumbnailUrl?: string;
  fullQualityUrl?: string;
  likeCount?: number;
  hasLiked?: boolean;
}

interface StoriesViewerProps {
  photos: Photo[];
  eventName: string;
  eventDescription: string | null;
  backgroundImage: string | null;
  totalPhotos: number;
  filterType: FilterType;
  language: "es" | "en" | "it";
  onClose: () => void;
  onLikePhoto: (photoId: string) => void;
}

const StoriesViewer = ({
  photos,
  eventName,
  eventDescription,
  backgroundImage,
  totalPhotos,
  filterType,
  language,
  onClose,
  onLikePhoto,
}: StoriesViewerProps) => {
  // Index 0 = cover slide, 1+ = photos
  const [currentIndex, setCurrentIndex] = useState(0);
  const totalSlides = photos.length + 1; // +1 for cover

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

  const currentPhoto = currentIndex > 0 ? photos[currentIndex - 1] : null;

  const photosText = language === "en" 
    ? `${totalPhotos} photos` 
    : language === "it" 
    ? `${totalPhotos} foto` 
    : `${totalPhotos} fotos`;

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
            {/* White gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-white/90" />
            
            {/* Event info */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-24 px-6 text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
                {eventName}
              </h1>
              {eventDescription && (
                <p className="text-muted-foreground text-lg md:text-xl max-w-md mb-4 whitespace-pre-line">
                  {eventDescription}
                </p>
              )}
              <p className="text-sm text-muted-foreground uppercase tracking-widest">
                ✨ {photosText}
              </p>
            </div>
          </div>
        ) : currentPhoto ? (
          // Photo slide
          <div className={`relative w-full h-full flex items-center justify-center ${getGrainClass(filterType)}`}>
            <img
              src={currentPhoto.fullQualityUrl || currentPhoto.thumbnailUrl}
              alt={language === "en" ? "Event photo" : language === "it" ? "Foto evento" : "Foto del evento"}
              className={`max-w-full max-h-full object-contain ${getFilterClass(filterType)}`}
            />
            
            {/* Like button - bottom right */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLikePhoto(currentPhoto.id);
              }}
              disabled={currentPhoto.hasLiked}
              className="absolute bottom-8 right-4 p-3 rounded-full bg-black/50 hover:bg-black/70 transition-colors disabled:opacity-50"
            >
              <img
                src={currentPhoto.hasLiked ? heartFilled : heartOutline}
                alt="like"
                className="w-8 h-8"
              />
            </button>

            {/* Photo counter */}
            <div className="absolute bottom-8 left-4 px-3 py-1 rounded-full bg-black/50 text-white text-sm">
              {currentIndex} / {photos.length}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default StoriesViewer;
