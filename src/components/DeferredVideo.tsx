import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type VideoHTMLAttributes } from "react";

type DeferredVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src" | "preload"> & {
  source: string;
};

/**
 * Keeps remote media detached until the user interacts with the native player.
 * This is stricter than preload="none", which Safari may still probe with a
 * Range request when a src is present.
 */
const DeferredVideo = ({ source, onPointerDown, onKeyDown, ...props }: DeferredVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const attachedSourceRef = useRef("");

  const attachSource = (video: HTMLVideoElement) => {
    if (!source || attachedSourceRef.current === source) return;
    video.src = source;
    attachedSourceRef.current = source;
    video.load();
  };

  const handlePointerDown = (event: PointerEvent<HTMLVideoElement>) => {
    attachSource(event.currentTarget);
    onPointerDown?.(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLVideoElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      attachSource(event.currentTarget);
    }
    onKeyDown?.(event);
  };

  useEffect(() => {
    const video = videoRef.current;
    attachedSourceRef.current = "";
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }

    return () => {
      if (!video) return;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [source]);

  return (
    <video
      {...props}
      ref={videoRef}
      preload="none"
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    />
  );
};

export default DeferredVideo;
