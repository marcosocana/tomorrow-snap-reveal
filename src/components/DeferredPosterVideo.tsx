import { useEffect, useRef, useState, type VideoHTMLAttributes } from "react";

type DeferredPosterVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "poster"> & {
  poster?: string | null;
  preloadMargin?: string;
};

/** Prevents a video poster from downloading until its tile is near the viewport. */
const DeferredPosterVideo = ({ poster, preloadMargin = "600px 0px", ...props }: DeferredPosterVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoadPoster, setShouldLoadPoster] = useState(false);

  useEffect(() => {
    if (shouldLoadPoster || !poster) return;
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") {
      setShouldLoadPoster(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoadPoster(true);
        observer.disconnect();
      },
      { rootMargin: preloadMargin },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [poster, preloadMargin, shouldLoadPoster]);

  return <video {...props} ref={videoRef} poster={shouldLoadPoster ? poster || undefined : undefined} />;
};

export default DeferredPosterVideo;
