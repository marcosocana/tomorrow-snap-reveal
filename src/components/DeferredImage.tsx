import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

type DeferredImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "loading"> & {
  src?: string | null;
  preloadMargin?: string;
};

/**
 * Keeps the remote source detached until the image is close to the viewport.
 * The img element itself is always rendered, so existing aspect-ratio and
 * placeholder styles continue to reserve exactly the same space.
 */
const DeferredImage = ({ src, preloadMargin = "600px 0px", ...props }: DeferredImageProps) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad || !src) return;
    const image = imageRef.current;
    if (!image || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: preloadMargin },
    );
    observer.observe(image);
    return () => observer.disconnect();
  }, [preloadMargin, shouldLoad, src]);

  return <img {...props} ref={imageRef} src={shouldLoad ? src || undefined : undefined} loading="lazy" />;
};

export default DeferredImage;
